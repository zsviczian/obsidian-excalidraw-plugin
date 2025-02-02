import {
  TFile,
  App,
  MarkdownView,
  normalizePath,
  Menu,
  MenuItem,
  Notice,
  Command,
  EventRef,
  FileView,
} from "obsidian";
import {
  VIEW_TYPE_EXCALIDRAW,
  ICON_NAME,
  IMAGE_TYPES,
  DEVICE,
  sceneCoordsToViewportCoords,
  fileid,
} from "../../constants/constants";
import ExcalidrawView, { TextMode } from "../../view/ExcalidrawView";
import {
  REGEX_LINK,
} from "../../shared/ExcalidrawData";
import { ExcalidrawSettings } from "../settings";
import { openDialogAction, OpenFileDialog } from "../../shared/Dialogs/OpenDrawing";
import { InsertLinkDialog } from "../../shared/Dialogs/InsertLinkDialog";
import { InsertCommandDialog } from "../../shared/Dialogs/InsertCommandDialog";
import { InsertImageDialog } from "../../shared/Dialogs/InsertImageDialog";
import { ImportSVGDialog } from "../../shared/Dialogs/ImportSVGDialog";
import { InsertMDDialog } from "../../shared/Dialogs/InsertMDDialog";
import { ExcalidrawAutomate } from "../../shared/ExcalidrawAutomate";
import { insertLaTeXToView, search } from "src/utils/excalidrawAutomateUtils";
import { templatePromt } from "../../shared/Dialogs/Prompt";
import { t } from "../../lang/helpers";
import {
  getAliasWithSize,
  getAnnotationFileNameAndFolder,
  getCropFileNameAndFolder,
  getDrawingFilename,
  getEmbedFilename,
  getIMGFilename,
  getLink,
  getListOfTemplateFiles,
  getURLImageExtension,
} from "../../utils/fileUtils";
import {
  setLeftHandedMode,
  sleep,
  decompress,
  getImageSize,
} from "../../utils/utils";
import { extractSVGPNGFileName, getActivePDFPageNumberFromPDFView, getAttachmentsFolderAndFilePath, isObsidianThemeDark, mergeMarkdownFiles, setExcalidrawView } from "../../utils/obsidianUtils";
import { ExcalidrawElement, ExcalidrawEmbeddableElement, ExcalidrawImageElement, ExcalidrawTextElement, FileId } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { ReleaseNotes } from "../../shared/Dialogs/ReleaseNotes";
import { ScriptInstallPrompt } from "../../shared/Dialogs/ScriptInstallPrompt";
import Taskbone from "../../shared/OCR/Taskbone";
import { emulateCTRLClickForLinks, linkClickModifierType, PaneTarget } from "../../utils/modifierkeyHelper";
import { InsertPDFModal } from "../../shared/Dialogs/InsertPDFModal";
import { ExportDialog } from "../../shared/Dialogs/ExportDialog";
import { UniversalInsertFileModal } from "../../shared/Dialogs/UniversalInsertFileModal";
import { PublishOutOfDateFilesDialog } from "../../shared/Dialogs/PublishOutOfDateFiles";
import { EmbeddableSettings } from "../../shared/Dialogs/EmbeddableSettings";
import { processLinkText } from "../../utils/customEmbeddableUtils";
import { getEA } from "src/core";
import { ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/excalidraw/types";
import { Mutable } from "@zsviczian/excalidraw/types/excalidraw/utility-types";
import { carveOutImage, carveOutPDF, createImageCropperFile } from "../../utils/carveout";
import { showFrameSettings } from "../../shared/Dialogs/FrameSettings";
import { insertImageToView } from "../../utils/excalidrawViewUtils";
import ExcalidrawPlugin from "src/core/main";
import { get } from "http";

declare const PLUGIN_VERSION:string;

export class CommandManager {
  private app: App;
  private plugin: ExcalidrawPlugin;
  private openDialog: OpenFileDialog;
  public insertLinkDialog: InsertLinkDialog;
  public insertCommandDialog: InsertCommandDialog;
  public insertImageDialog: InsertImageDialog;
  public importSVGDialog: ImportSVGDialog;
  public insertMDDialog: InsertMDDialog;
  public taskbone: Taskbone;
  public forceSaveCommand:Command;

  get settings(): ExcalidrawSettings {
    return this.plugin.settings;
  }

  get ea(): ExcalidrawAutomate {
    return this.plugin.ea;
  }

  private isExcalidrawFile(file: TFile): boolean {
    return this.plugin.isExcalidrawFile(file);
  }
  
  constructor(plugin: ExcalidrawPlugin) {
    this.app = plugin.app;
    this.plugin = plugin;
  }

  public initialize() {
    try {
      this.taskbone = new Taskbone(this.plugin);
      this.registerCommands();
    } catch (e) {
      new Notice("Error registering commands", 6000);
      console.error("Error registering commands", e);
    }
    this.plugin.logStartupEvent("Commands registered");
  }

  destroy() {
    this.openDialog.destroy();
    this.openDialog = null;
    this.insertLinkDialog.destroy();
    this.insertLinkDialog = null;
    this.insertCommandDialog.destroy();
    this.insertCommandDialog = null;
    this.importSVGDialog.destroy();
    this.importSVGDialog = null;
    this.insertImageDialog.destroy();
    this.insertImageDialog = null;
    this.insertMDDialog.destroy();
    this.insertMDDialog = null;
    if (this.taskbone) {
      this.taskbone.destroy();
      this.taskbone = null;
    }
    this.forceSaveCommand = null;
  }

  private registerEvent(event: EventRef): void {
    this.plugin.registerEvent(event);
  }

  private addCommand(command: Command): Command {
    return this.plugin.addCommand(command);
  }

  private registerCommands() {
    this.openDialog = new OpenFileDialog(this.app, this.plugin);
    this.insertLinkDialog = new InsertLinkDialog(this.plugin);
    this.insertCommandDialog = new InsertCommandDialog(this.app);
    this.insertImageDialog = new InsertImageDialog(this.plugin);
    this.importSVGDialog = new ImportSVGDialog(this.plugin);
    this.insertMDDialog = new InsertMDDialog(this.plugin);

    const createNewAction = (e: MouseEvent | KeyboardEvent, file: TFile) => {
      let folderpath = file.path;
      if (file instanceof TFile) {
        folderpath = normalizePath(
          file.path.substr(0, file.path.lastIndexOf(file.name)),
        );
      }
      this.plugin.createAndOpenDrawing(
        getDrawingFilename(this.settings),
        linkClickModifierType(emulateCTRLClickForLinks(e)),
        folderpath,
      );
    }

    const fileMenuHandlerCreateNew = (menu: Menu, file: TFile) => {
      menu.addItem((item: MenuItem) => {
        item
          .setSection('action-primary')
          .setTitle(t("CREATE_NEW"))
          .setIcon(ICON_NAME)
          .onClick((e) => {createNewAction(e, file)});
      });
    };

    this.registerEvent(
      this.app.workspace.on("file-menu", fileMenuHandlerCreateNew),
    );

    const fileMenuHandlerConvertKeepExtension = (menu: Menu, file: TFile) => {
      if (file instanceof TFile && file.extension == "excalidraw") {
        menu.addItem((item: MenuItem) => {
          item.setTitle(t("CONVERT_FILE_KEEP_EXT")).onClick(() => {
            this.plugin.convertSingleExcalidrawToMD(file, false, false);
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
            this.plugin.convertSingleExcalidrawToMD(file, true, true);
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
      id: "excalidraw-convert-image-from-url-to-local-file",
      name: t("CONVERT_URL_TO_FILE"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if(!view) return false;
        const img = view.getSingleSelectedImage();
        if(!img || !img.embeddedFile?.isHyperLink) return false;
        if(checking) return true;
        view.convertImageElWithURLToLocalFile(img);
      },
    });

    this.addCommand({
      id: "excalidraw-unzip-file",
      name: t("UNZIP_CURRENT_FILE"),
      checkCallback: (checking: boolean) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
          return false;
        }
        const fileIsExcalidraw = this.isExcalidrawFile(activeFile);
        if (!fileIsExcalidraw) {
          return false;
        }

        const excalidrawView = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (excalidrawView) {
          return false;
        }

        if (checking) {
          return true;
        }

        (async () => {
          const data = await this.app.vault.read(activeFile);
          const parts = data.split("\n## Drawing\n```compressed-json\n");
          if(parts.length!==2) return;
          const header = parts[0] + "\n## Drawing\n```json\n";
          const compressed = parts[1].split("\n```\n%%");
          if(compressed.length!==2) return;
          const decompressed = decompress(compressed[0]);
          if(!decompressed) {
            new Notice("The compressed string is corrupted. Unable to decompress data.");
            return;
          }
          await this.app.vault.modify(activeFile,header + decompressed + "\n```\n%%" + compressed[1]);
        })();

      }
    })

    this.addCommand({
      id: "excalidraw-publish-svg-check",
      name: t("PUBLISH_SVG_CHECK"),
      checkCallback: (checking: boolean) => {
        const publish = this.app.internalPlugins.plugins["publish"].instance;
        if (!publish) {
          return false;
        }
        if (checking) {
          return true;
        }
        (new PublishOutOfDateFilesDialog(this.plugin)).open();
      }
    })

    this.addCommand({
      id: "excalidraw-embeddable-poroperties",
      name: t("EMBEDDABLE_PROPERTIES"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if(!view) return false;
        if(!view.excalidrawAPI) return false;
        const els = view.getViewSelectedElements().filter(el=>el.type==="embeddable") as ExcalidrawEmbeddableElement[];
        if(els.length !== 1) {
          if(checking) return false;
          new Notice("Select a single embeddable element and try again");
          return false;
        }
        if(checking) return true;
        const getFile = (el:ExcalidrawEmbeddableElement):TFile => {
          const res = REGEX_LINK.getRes(el.link).next();
          if(!res || (!res.value && res.done)) {
            return null;
          }
          const link = REGEX_LINK.getLink(res);
          const { file } = processLinkText(link, view);
          return file;
        }
        new EmbeddableSettings(view.plugin,view,getFile(els[0]),els[0]).open();
      }
    })

    this.addCommand({
      id: "excalidraw-embeddables-relative-scale",
      name: t("EMBEDDABLE_RELATIVE_ZOOM"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if(!view) return false;
        if(!view.excalidrawAPI) return false;
        const els = view.getViewSelectedElements().filter(el=>el.type==="embeddable") as ExcalidrawEmbeddableElement[];
        if(els.length === 0) {
          if(checking) return false;
          new Notice("Select at least one embeddable element and try again");
          return false;
        }
        if(checking) return true;
        const ea = getEA(view) as ExcalidrawAutomate;
        const api = ea.getExcalidrawAPI() as ExcalidrawImperativeAPI;
        ea.copyViewElementsToEAforEditing(els);
        const scale = 1/api.getAppState().zoom.value;
        ea.getElements().forEach((el: Mutable<ExcalidrawEmbeddableElement>)=>{
          el.scale = [scale,scale];
        })
        ea.addElementsToView().then(()=>ea.destroy());
      }
    })

    this.addCommand({
      id: "open-image-excalidraw-source",
      name: t("OPEN_IMAGE_SOURCE"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if(!view) return false;
        if(view.leaf !== this.app.workspace.activeLeaf) return false;
        const editor = view.editor;
        if(!editor) return false;
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const fname = extractSVGPNGFileName(line);
        if(!fname) return false;
        const imgFile = this.app.metadataCache.getFirstLinkpathDest(fname, view.file.path);
        if(!imgFile) return false;
        const excalidrawFname = getIMGFilename(imgFile.path, "md");
        let excalidrawFile = this.app.metadataCache.getFirstLinkpathDest(excalidrawFname, view.file.path);
        if(!excalidrawFile) {
          if(excalidrawFname.endsWith(".dark.md")) {
            excalidrawFile = this.app.metadataCache.getFirstLinkpathDest(excalidrawFname.replace(/\.dark\.md$/,".md"), view.file.path);
          }
          if(excalidrawFname.endsWith(".light.md")) {
            excalidrawFile = this.app.metadataCache.getFirstLinkpathDest(excalidrawFname.replace(/\.light\.md$/,".md"), view.file.path);
          }
          if(!excalidrawFile) return false;
        }
        if(checking) return true;
        this.plugin.openDrawing(excalidrawFile, "new-tab", true);
      }
    });

    this.addCommand({
      id: "excalidraw-disable-autosave",
      name: t("TEMPORARY_DISABLE_AUTOSAVE"),
      checkCallback: (checking) => {
        if(!this.settings.autosave) return false; //already disabled
        if(checking) return true;
        this.settings.autosave = false;
        return true;
      }
    })

    this.addCommand({
      id: "excalidraw-enable-autosave",
      name: t("TEMPORARY_ENABLE_AUTOSAVE"),
      checkCallback: (checking) => {
        if(this.settings.autosave) return false; //already enabled
        if(checking) return true;
        this.settings.autosave = true;
        return true;
      }
    })    

    this.addCommand({
      id: "excalidraw-download-lib",
      name: t("DOWNLOAD_LIBRARY"),
      callback: ()=>this.plugin.exportLibrary(),
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
          return Boolean(this.app.workspace.getActiveViewOfType(MarkdownView)) 
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
            Boolean(this.app.workspace.getActiveViewOfType(MarkdownView)) &&
            this.plugin.lastActiveExcalidrawFilePath !== null
          );
        }
        const file = this.app.vault.getAbstractFileByPath(
          this.plugin.lastActiveExcalidrawFilePath,
        );
        if (!(file instanceof TFile)) {
          return false;
        }
        this.plugin.embedDrawing(file);
        return true;
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate",
      name: t("NEW_IN_NEW_PANE"),
      callback: () => {
        this.plugin.createAndOpenDrawing(getDrawingFilename(this.settings), "new-pane");
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate-newtab",
      name: t("NEW_IN_NEW_TAB"),
      callback: () => {
        this.plugin.createAndOpenDrawing(getDrawingFilename(this.settings), "new-tab");
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate-on-current",
      name: t("NEW_IN_ACTIVE_PANE"),
      callback: () => {
        this.plugin.createAndOpenDrawing(getDrawingFilename(this.settings), "active-pane");
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate-popout",
      name: t("NEW_IN_POPOUT_WINDOW"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return !DEVICE.isMobile;
        }
        this.plugin.createAndOpenDrawing(getDrawingFilename(this.settings), "popout-window");
      },
    });

    const insertDrawingToDoc = async (
      location: PaneTarget
    ) => {
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView) {
        return;
      }
      const filename = getEmbedFilename(
        activeView.file.basename,
        this.settings,
      );
      const folder = this.settings.embedUseExcalidrawFolder
        ? null
        : (
            await getAttachmentsFolderAndFilePath(
              this.app,
              activeView.file.path,
              filename,
            )
          ).folder;
      const file = await this.plugin.createDrawing(filename, folder);
      await this.plugin.embedDrawing(file);
      this.plugin.openDrawing(file, location, true, undefined, true);
    };

    this.addCommand({
      id: "excalidraw-autocreate-and-embed",
      name: t("NEW_IN_NEW_PANE_EMBED"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(MarkdownView));
        }
        insertDrawingToDoc("new-pane");
        return true;
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate-and-embed-new-tab",
      name: t("NEW_IN_NEW_TAB_EMBED"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(MarkdownView));
        }
        insertDrawingToDoc("new-tab");
        return true;
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate-and-embed-on-current",
      name: t("NEW_IN_ACTIVE_PANE_EMBED"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(MarkdownView));
        }
        insertDrawingToDoc("active-pane");
        return true;
      },
    });

    this.addCommand({
      id: "excalidraw-autocreate-and-embed-popout",
      name: t("NEW_IN_POPOUT_WINDOW_EMBED"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return !DEVICE.isMobile && Boolean(this.app.workspace.getActiveViewOfType(MarkdownView));
        }
        insertDrawingToDoc("popout-window");
        return true;
      },
    });    

    this.addCommand({
      id: "run-ocr",
      name: t("RUN_OCR"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (checking) {
          return (
            Boolean(view)
          );
        }
        if (view) {
          if(!this.settings.taskboneEnabled) {
            new Notice("Taskbone OCR is not enabled. Please go to plugins settings to enable it.",4000);
            return true;
          }
          this.taskbone.getTextForView(view, {forceReScan: false});
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "rerun-ocr",
      name: t("RERUN_OCR"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (checking) {
          return (
            Boolean(view)
          );
        }
        if (view) {
          if(!this.settings.taskboneEnabled) {
            new Notice("Taskbone OCR is not enabled. Please go to plugins settings to enable it.",4000);
            return true;
          }
          this.taskbone.getTextForView(view, {forceReScan: true});
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "run-ocr-selectedelements",
      name: t("RUN_OCR_ELEMENTS"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (checking) {
          return (
            Boolean(view)
          );
        }
        if (view) {
          if(!this.settings.taskboneEnabled) {
            new Notice("Taskbone OCR is not enabled. Please go to plugins settings to enable it.",4000);
            return true;
          }
          this.taskbone.getTextForView(view, {forceReScan: false, selectedElementsOnly: true, addToFrontmatter: false});
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "search-text",
      name: t("SEARCH"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          );
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          search(view);
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "fullscreen",
      name: t("TOGGLE_FULLSCREEN"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          );
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          if (view.isFullscreen()) {
            view.exitFullscreen();
          } else {
            view.gotoFullscreen();
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "disable-binding",
      name: t("TOGGLE_DISABLEBINDING"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          );
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          view.toggleDisableBinding();
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "disable-framerendering",
      name: t("TOGGLE_FRAME_RENDERING"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          );
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          view.toggleFrameRendering();
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "frame-settings",
      name: t("FRAME_SETTINGS_TITLE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          );
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          showFrameSettings(getEA(view));
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "copy-link-to-drawing",
      name: t("COPY_DRAWING_LINK"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          );
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          navigator.clipboard.writeText(`![[${view.file.path}]]`);
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "disable-frameclipping",
      name: t("TOGGLE_FRAME_CLIPPING"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          );
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          view.toggleFrameClipping();
          return true;
        }
        return false;
      },
    });


    this.addCommand({
      id: "export-image",
      name: t("EXPORT_IMAGE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          );
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          if(!view.exportDialog) {
            view.exportDialog = new ExportDialog(this.plugin, view,view.file);
          }
          view.exportDialog.open();
          return true;
        }
        return false;
      },
    });

    this.forceSaveCommand = this.addCommand({
      id: "save",
      hotkeys: [{modifiers: ["Ctrl"], key:"s"}], //See also Poposcope
      name: t("FORCE_SAVE"),
      checkCallback: (checking:boolean) => this.plugin.forceSaveActiveView(checking),
    })

    this.addCommand({
      id: "toggle-lock",
      name: t("TOGGLE_LOCK"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          if (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          ) {
            return !(this.app.workspace.getActiveViewOfType(ExcalidrawView))
              .compatibilityMode;
          }
          return false;
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view && !view.compatibilityMode) {
          view.changeTextMode(
            view.textMode === TextMode.parsed ? TextMode.raw : TextMode.parsed,
          );
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "scriptengine-store",
      name: t("INSTALL_SCRIPT_BUTTON"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          );
        }
        new ScriptInstallPrompt(this.plugin).open();
        return true;
      },
    });

    this.addCommand({
      id: "delete-file",
      name: t("DELETE_FILE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
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
      id: "convert-text2MD",
      name: t("CONVERT_TO_MARKDOWN"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView)
        if(!view) return false;
        const selectedTextElements = view.getViewSelectedElements().filter(el=>el.type === "text");
        if(selectedTextElements.length !==1 ) return false;
        const selectedTextElement = selectedTextElements[0] as ExcalidrawTextElement;
        const containerElement = (view.getViewElements() as ExcalidrawElement[]).find(el=>el.id === selectedTextElement.containerId);
        if(containerElement && containerElement.type === "arrow") return false;
        if(checking) return true;
        view.convertTextElementToMarkdown(selectedTextElement, containerElement);
      }
    })

    this.addCommand({
      id: "insert-link",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "k" }],
      name: t("INSERT_LINK"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          this.insertLinkDialog.start(view.file.path, (markdownlink: string, path:string, alias:string) => view.addLink(markdownlink, path, alias));
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-command",
      name: t("INSERT_COMMAND"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          this.insertCommandDialog.start((text: string, fontFamily?: 1 | 2 | 3 | 4, save?: boolean) => view.addText(text, fontFamily, save));
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-link-to-element",
      name: t("INSERT_LINK_TO_ELEMENT_NORMAL"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          view.copyLinkToSelectedElementToClipboard("");
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-link-to-element-group",
      name: t("INSERT_LINK_TO_ELEMENT_GROUP"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          view.copyLinkToSelectedElementToClipboard("group=");
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-link-to-element-frame",
      name: t("INSERT_LINK_TO_ELEMENT_FRAME"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView));
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          view.copyLinkToSelectedElementToClipboard("frame=");
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-link-to-element-frame-clipped",
      name: t("INSERT_LINK_TO_ELEMENT_FRAME_CLIPPED"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView));
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          view.copyLinkToSelectedElementToClipboard("clippedframe=");
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-link-to-element-area",
      name: t("INSERT_LINK_TO_ELEMENT_AREA"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          view.copyLinkToSelectedElementToClipboard("area=");
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "toggle-lefthanded-mode",
      name: t("TOGGLE_LEFTHANDED_MODE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          if(this.app.workspace.getActiveViewOfType(ExcalidrawView)) {
            const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
            const api = view?.excalidrawAPI;
            if(!api) return false;
            const st = api.getAppState();
            if(!st.trayModeEnabled) return false;
            return true;
          }
          return false;
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        (async()=>{
          const isLeftHanded = this.settings.isLeftHanded;
          await this.plugin.loadSettings({applyLefthandedMode: false});
          this.settings.isLeftHanded = !isLeftHanded;
          this.plugin.saveSettings();
          //not clear why I need to do this. If I don't double apply the stylesheet changes 
          //then the style won't be applied in the popout windows
          setLeftHandedMode(!isLeftHanded);
          setTimeout(()=>setLeftHandedMode(!isLeftHanded));
        })()
        return true;
      },
    });

    this.addCommand({
      id: "flip-image",
      name: t("FLIP_IMAGE"),
      checkCallback: (checking:boolean) => {
        if (!DEVICE.isDesktop) return;
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if(!view) return false;
        if(!view.excalidrawAPI) return false;
        const els = view
          .getViewSelectedElements()
          .filter(el=>{
            if(el.type==="image") {
              const ef = view.excalidrawData.getFile(el.fileId);
              if(!ef) {
                return false;
              }
              return this.isExcalidrawFile(ef.file);
            }
            return false;
          });
        if(els.length !== 1) {
          return false;
        }
        if(checking) return true;
        const el = els[0] as ExcalidrawImageElement;
        let ef = view.excalidrawData.getFile(el.fileId);
        this.plugin.forceToOpenInMarkdownFilepath = ef.file?.path;
        const appState = view.excalidrawAPI.getAppState();
        const {x:centerX,y:centerY} = sceneCoordsToViewportCoords({sceneX:el.x+el.width/2,sceneY:el.y+el.height/2},appState);
        const {width, height} = {width:600, height:600};
        const {x,y} = {
          x:Math.max(0,centerX - width/2 + view.ownerWindow.screenX),
          y:Math.max(0,centerY - height/2 + view.ownerWindow.screenY),
        }
      
        this.plugin.openDrawing(ef.file, DEVICE.isMobile ? "new-tab":"popout-window", true, undefined, false, {x,y,width,height});
      }
    })

    this.addCommand({
      id: "duplicate-image",
      name: t("DUPLICATE_IMAGE"),
      checkCallback: (checking:boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if(!view) return false;
        if(!view.excalidrawAPI) return false;
        const els = view.getViewSelectedElements().filter(el=>el.type==="image");
        if(els.length !== 1) {
          if(checking) return false;
          new Notice("Select a single image element and try again");
          return false;
        }
        const el = els[0] as ExcalidrawImageElement;
        const ef = view.excalidrawData.getFile(el.fileId);
        if(!ef?.file) return false;
        if(checking) return true;
        (async()=>{
          const ea = getEA(view) as ExcalidrawAutomate;
          const isAnchored = Boolean(el.customData?.isAnchored); 
          const imgId = await ea.addImage(el.x+el.width/5, el.y+el.height/5, ef.file,!isAnchored, isAnchored);
          const img = ea.getElement(imgId) as Mutable<ExcalidrawImageElement>;
          img.width = el.width;
          img.height = el.height;
          if(el.crop) img.crop = {...el.crop};
          const newFileId = fileid() as FileId;
          ea.imagesDict[newFileId] = ea.imagesDict[img.fileId];
          ea.imagesDict[newFileId].id = newFileId;
          delete ea.imagesDict[img.fileId]
          img.fileId = newFileId;
          await ea.addElementsToView(false, false, true);
          ea.selectElementsInView([imgId]);
          ea.destroy();
        })();
      }
    })

    this.addCommand({
      id: "reset-image-to-100",
      name: t("RESET_IMG_TO_100"),
      checkCallback: (checking:boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if(!view) return false;
        if(!view.excalidrawAPI) return false;
        const els = view.getViewSelectedElements().filter(el=>el.type==="image");
        if(els.length !== 1) {
          if(checking) return false;
          new Notice("Select a single image element and try again");
          return false;
        }
        if(checking) return true;
        
        (async () => {
          const el = els[0] as ExcalidrawImageElement;
          let ef = view.excalidrawData.getFile(el.fileId);
          if(!ef) {
            await view.forceSave();
            let ef = view.excalidrawData.getFile(el.fileId);
            new Notice("Select a single image element and try again");
            return false;
          }

          const ea = new ExcalidrawAutomate(this.plugin,view);
          const size = await ea.getOriginalImageSize(el);
          if(size) {
            ea.copyViewElementsToEAforEditing(els);
            const eaEl = ea.getElement(el.id) as Mutable<ExcalidrawImageElement>;
            if(eaEl.crop) {
              eaEl.width = eaEl.crop.width;
              eaEl.height = eaEl.crop.height;
            } else {
              eaEl.width = size.width; eaEl.height = size.height;
            }
            await ea.addElementsToView(false,false,false);
          }
          ea.destroy();
        })()
      }
    })

    this.addCommand({
      id: "reset-image-ar",
      name: t("RESET_IMG_ASPECT_RATIO"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (!view) return false;
        if (!view.excalidrawAPI) return false;
        const els = view.getViewSelectedElements().filter(el => el.type === "image");
        if (els.length !== 1) {
          if (checking) return false;
          new Notice("Select a single image element and try again");
          return false;
        }
        if (checking) return true;
    
        (async () => {
          const el = els[0] as ExcalidrawImageElement;
          let ef = view.excalidrawData.getFile(el.fileId);
          if (!ef) {
            await view.forceSave();
            let ef = view.excalidrawData.getFile(el.fileId);
            new Notice("Select a single image element and try again");
            return false;
          }
    
          const ea = new ExcalidrawAutomate(this.plugin, view);
          if (await ea.resetImageAspectRatio(el)) {
            await ea.addElementsToView(false, false, false);
          }
          ea.destroy();
        })();
      }
    });
    
    this.addCommand({
      id: "open-link-props",
      name: t("OPEN_LINK_PROPS"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (!view) return false;
        if (!view.excalidrawAPI) return false;
        const els = view.getViewSelectedElements().filter(el => el.type === "image");
        if (els.length !== 1) {
          if (checking) return false;
          new Notice("Select a single image element and try again");
          return false;
        }
        if (checking) return true;

        const el = els[0] as ExcalidrawImageElement;
        let ef = view.excalidrawData.getFile(el.fileId);
        let eq = view.excalidrawData.getEquation(el.fileId);
        if (!ef && !eq) {
          view.forceSave();
          new Notice("Please try again.");
          return false;
        }

        if(ef) {
          view.openEmbeddedLinkEditor(el.id);
        }
        if(eq) {
          view.openLaTeXEditor(el.id);
        }
      }
    });

    this.addCommand({
      id: "convert-card-to-file",
      name: t("CONVERT_CARD_TO_FILE"),
      checkCallback: (checking:boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if(!view) return false;
        if(!view.excalidrawAPI) return false;
        const els = view.getViewSelectedElements().filter(el=>el.type==="embeddable");
        if(els.length !== 1) {
          if(checking) return false;
          new Notice("Select a single back-of-the-note card and try again");
          return false;
        }
        const embeddableData = view.getEmbeddableLeafElementById(els[0].id);
        const child = embeddableData?.node?.child;
        if(!child || (child.file !== view.file)) {
          if(checking) return false;
          new Notice("The selected embeddable is not a back-of-the-note card.");
          return false;
        }
        if(checking) return true;
        view.moveBackOfTheNoteCardToFile();
      }
    })

    this.addCommand({
      id: "insert-active-pdfpage",
      name: t("INSERT_ACTIVE_PDF_PAGE_AS_IMAGE"),
      checkCallback: (checking:boolean) => {
        const excalidrawView = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if(!excalidrawView) return false;
        const embeddables = excalidrawView.getViewSelectedElements().filter(el=>el.type==="embeddable");
        if(embeddables.length !== 1) {
          if(checking) return false;
          new Notice("Select a single PDF embeddable and try again");
          return false;
        }
        const isPDF = excalidrawView.getEmbeddableLeafElementById(embeddables[0].id)?.leaf?.view?.getViewType() === "pdf"
        if(!isPDF) return false;
        const page = getActivePDFPageNumberFromPDFView(excalidrawView.getEmbeddableLeafElementById(embeddables[0].id)?.leaf?.view);
        if(!page) return false;
        if(checking) return true;

        const embeddableEl = embeddables[0] as ExcalidrawEmbeddableElement;
        const ea = new ExcalidrawAutomate(this.plugin,excalidrawView);
        const view = excalidrawView.getEmbeddableLeafElementById(embeddableEl.id)?.leaf?.view;
        const pdfFile: TFile = view && (view instanceof FileView) ? view.file : undefined;
        (async () => {
          const imgID = await ea.addImage(embeddableEl.x + embeddableEl.width + 10, embeddableEl.y, `${pdfFile?.path}#page=${page}`, false, false);
          const imgEl = ea.getElement(imgID) as Mutable<ExcalidrawImageElement>;
          const imageAspectRatio = imgEl.width / imgEl.height;
          if(imageAspectRatio > 1) {
            imgEl.width = embeddableEl.width;
            imgEl.height = embeddableEl.width / imageAspectRatio;
          } else {
            imgEl.height = embeddableEl.height;
            imgEl.width = embeddableEl.height * imageAspectRatio;
          }
          ea.addElementsToView(false, true, true);
        })()
      }
    })

    this.addCommand({
      id: "crop-image",
      name: t("CROP_IMAGE"),
      checkCallback: (checking:boolean) => {
        const excalidrawView = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        const canvasView:any = this.app.workspace.activeLeaf?.view;
        const isCanvas = canvasView && canvasView.getViewType() === "canvas";
        if(!excalidrawView && !markdownView && !isCanvas) return false;

        if(excalidrawView) {
          if(!excalidrawView.excalidrawAPI) return false;
          const embeddables = excalidrawView.getViewSelectedElements().filter(el=>el.type==="embeddable");
          const imageEls = excalidrawView.getViewSelectedElements().filter(el=>el.type==="image");
          const isPDF = (imageEls.length === 0 && embeddables.length === 1 && excalidrawView.getEmbeddableLeafElementById(embeddables[0].id)?.leaf?.view?.getViewType() === "pdf")
          const isImage = (imageEls.length === 1 && embeddables.length === 0)

          if(!isPDF && !isImage) {
            if(checking) return false;
            new Notice("Select a single image element or single PDF embeddable and try again");
            return false;
          }

          const page = isPDF ? getActivePDFPageNumberFromPDFView(excalidrawView.getEmbeddableLeafElementById(embeddables[0].id)?.leaf?.view) : undefined;
          if(isPDF && !page) {
            return false;
          }

          if(checking) return true;

          if(isPDF) {
            const embeddableEl = embeddables[0] as ExcalidrawEmbeddableElement;
            const ea = new ExcalidrawAutomate(this.plugin,excalidrawView);
            const view = excalidrawView.getEmbeddableLeafElementById(embeddableEl.id)?.leaf?.view;
            const pdfFile: TFile = view && (view instanceof FileView) ? view.file : undefined;
            carveOutPDF(ea, embeddableEl, `${pdfFile?.path}#page=${page}`, pdfFile);
            return;
          }

          const imageEl = imageEls[0] as ExcalidrawImageElement;
          (async () => {
            let ef = excalidrawView.excalidrawData.getFile(imageEl.fileId);

            if(!ef) {
              await excalidrawView.save();
              await sleep(500);
              ef = excalidrawView.excalidrawData.getFile(imageEl.fileId);
              if(!ef) {             
                new Notice("Select a single image element and try again");
                return false;
              }
            }
            const ea = new ExcalidrawAutomate(this.plugin,excalidrawView);
            carveOutImage(ea, imageEl);
          })();
        }

        const carveout = async (isFile: boolean, sourceFile: TFile, imageFile: TFile, imageURL: string, replacer: Function, ref?: string) => {
          const ea = getEA() as ExcalidrawAutomate;
          const imageID = await ea.addImage(
            0, 0,
            isFile
              ? ((isFile && imageFile.extension === "pdf" && ref) ? `${imageFile.path}#${ref}` : imageFile)
              : imageURL,
            false, false
          );
          if(!imageID) {
            new Notice(`Can't load image\n\n${imageURL}`);
            return;
          }
          
          let fnBase = "";
          let imageLink = "";
          if(isFile) {
            fnBase = imageFile.basename;
            imageLink = ref
              ? `[[${imageFile.path}#${ref}]]`
              : `[[${imageFile.path}]]`;
          } else {
            imageLink = imageURL;
            const imagename = imageURL.match(/^.*\/([^?]*)\??.*$/)?.[1];
            fnBase = imagename.substring(0,imagename.lastIndexOf("."));
          }
          
          const {folderpath, filename} = await getCropFileNameAndFolder(this.plugin,sourceFile.path,fnBase)
          const newFile = await createImageCropperFile(ea,imageID,imageLink,folderpath,filename);
          ea.destroy();
          if(!newFile) return;
          const link = this.app.metadataCache.fileToLinktext(newFile,sourceFile.path, true);
          replacer(link, newFile);
        }

        if(isCanvas) {
          const selectedNodes:any = [];
          canvasView.canvas.nodes.forEach((node:any) => {
            if(node.nodeEl.hasClass("is-focused")) selectedNodes.push(node);
          })
          if(selectedNodes.length !== 1) return false;
          const node = selectedNodes[0];
          let extension = "";
          let isExcalidraw = false;
          if(node.file) {
            extension = node.file.extension;
            isExcalidraw = this.isExcalidrawFile(node.file);
          }
          if(node.url) {
            extension = getURLImageExtension(node.url);
          }
          const page = extension === "pdf" ? getActivePDFPageNumberFromPDFView(node?.child) : undefined;
          if(!page && !IMAGE_TYPES.contains(extension) && !isExcalidraw) return false;
          if(checking) return true;

          const replacer = (link:string, file: TFile) => {
            if(node.file) {
              (node.file.extension === "pdf")
                ? node.canvas.createFileNode({pos:{x:node.x + node.width + 10,y: node.y}, file})
                : node.setFile(file);
            }
            if(node.url) {
              node.canvas.createFileNode({pos:{x:node.x + 20,y: node.y+20}, file});
            }
          }
          carveout(Boolean(node.file), canvasView.file, node.file, node.url, replacer, page ? `page=${page}` : undefined);
        }

        if (markdownView) {
          const editor = markdownView.editor;
          const cursor = editor.getCursor();
          const line = editor.getLine(cursor.line);
          const parts = REGEX_LINK.getResList(line);
          if(parts.length === 0) return false;
          let imgpath = REGEX_LINK.getLink(parts[0]);
          const isWikilink = REGEX_LINK.isWikiLink(parts[0]);
          let alias = REGEX_LINK.getAliasOrLink(parts[0]);
          if(alias === imgpath) alias = null;
          imgpath = decodeURI(imgpath);
          const imagePathParts = imgpath.split("#");
          const hasRef = imagePathParts.length === 2;
          const imageFile = this.app.metadataCache.getFirstLinkpathDest(
            hasRef ? imagePathParts[0] : imgpath,
            markdownView.file.path
          );
          const isFile = (imageFile && imageFile instanceof TFile);
          const isExcalidraw = isFile ? this.isExcalidrawFile(imageFile) : false;
          let imagepath = isFile ? imageFile.path : "";
          let extension = isFile ? imageFile.extension : "";
          if(imgpath.match(/^https?|file/)) {
            imagepath = imgpath;
            extension = getURLImageExtension(imgpath);
          }
          if(imagepath === "") return false;
          if(extension !== "pdf" && !IMAGE_TYPES.contains(extension) && !isExcalidraw) return false;
          if(checking) return true;
          const ref = imagePathParts[1];
          const replacer = (link:string) => {
            const lineparts = line.split(parts[0].value[0]) 
            const pdfLink = isFile && ref 
              ? "\n" + getLink(this.plugin ,{
                  embed: false,
                  alias: alias ?? `${imageFile.basename}, ${ref.replace("="," ")}`,
                  path:`${imageFile.path}#${ref}`
                }, isWikilink) 
              : "";
            editor.setLine(cursor.line,lineparts[0] + getLink(this.plugin ,{embed: true, path:link, alias}, isWikilink) + pdfLink + lineparts[1]);
          }
          carveout(isFile, markdownView.file, imageFile, imagepath, replacer, ref);
        }
      }
    })

    this.addCommand({
      id: "annotate-image",
      name: t("ANNOTATE_IMAGE"),
      checkCallback: (checking:boolean) => {
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        const canvasView:any = this.app.workspace.activeLeaf?.view;
        const isCanvas = canvasView && canvasView.getViewType() === "canvas";
        if(!markdownView && !isCanvas) return false;

        const carveout = async (isFile: boolean, sourceFile: TFile, imageFile: TFile, imageURL: string, replacer: Function, ref?: string) => {
          const ea = getEA() as ExcalidrawAutomate;
          const imageID = await ea.addImage(
            0, 0,
            isFile
              ? ((isFile && imageFile.extension === "pdf" && ref) ? `${imageFile.path}#${ref}` : imageFile)
              : imageURL,
            false, false
          );
          if(!imageID) {
            new Notice(`Can't load image\n\n${imageURL}`);
            ea.destroy();
            return;
          }
          const el = ea.getElement(imageID) as Mutable<ExcalidrawImageElement>;
          el.locked = true;
          const size = this.settings.annotatePreserveSize
            ? await getImageSize(ea.imagesDict[el.fileId].dataURL)
            : null;
          let fnBase = "";
          let imageLink = "";
          if(isFile) {
            fnBase = imageFile.basename;
            imageLink = ref
              ? `[[${imageFile.path}#${ref}]]`
              : `[[${imageFile.path}]]`;
          } else {
            imageLink = imageURL;
            const imagename = imageURL.match(/^.*\/([^?]*)\??.*$/)?.[1];
            fnBase = imagename.substring(0,imagename.lastIndexOf("."));
          }
          
          let template:TFile;
          const templates = getListOfTemplateFiles(this.plugin);
          if(templates) {
            template = await templatePromt(templates, this.app);
          }

          const {folderpath, filename} = await getAnnotationFileNameAndFolder(this.plugin,sourceFile.path,fnBase)
          const newPath = await ea.create ({
            templatePath: template?.path,
            filename,
            foldername: folderpath,
            onNewPane: true,
            frontmatterKeys: {
              ...this.settings.matchTheme ? {"excalidraw-export-dark": isObsidianThemeDark()} : {},
              ...(imageFile.extension === "pdf") ? {"cssclasses": "excalidraw-cropped-pdfpage"} : {},
            }
          });
          ea.destroy();

          //wait for file to be created/indexed by Obsidian
          let newFile = this.app.vault.getAbstractFileByPath(newPath);
          let counter = 0;
          while((!newFile || !this.isExcalidrawFile(newFile as TFile)) && counter < 50) {
            await sleep(100);
            newFile = this.app.vault.getAbstractFileByPath(newPath);
            counter++;
          }
          //console.log({counter, file});
          if(!newFile || !(newFile instanceof TFile)) {
            new Notice("File not found. NewExcalidraw Drawing is taking too long to create. Please try again.");
            return;
          }

          if(!newFile) return;
          const link = this.app.metadataCache.fileToLinktext(newFile,sourceFile.path, true);
          replacer(link, newFile, size ? `${size.width}` : null);
        }

        if(isCanvas) {
          const selectedNodes:any = [];
          canvasView.canvas.nodes.forEach((node:any) => {
            if(node.nodeEl.hasClass("is-focused")) selectedNodes.push(node);
          })
          if(selectedNodes.length !== 1) return false;
          const node = selectedNodes[0];
          let extension = "";
          let isExcalidraw = false;
          if(node.file) {
            extension = node.file.extension;
            isExcalidraw = this.isExcalidrawFile(node.file);
          }
          if(node.url) {
            extension = getURLImageExtension(node.url);
          }
          const page = extension === "pdf" ? getActivePDFPageNumberFromPDFView(node?.child) : undefined;
          if(!page && !IMAGE_TYPES.contains(extension) && !isExcalidraw) return false;
          if(checking) return true;

          const replacer = (link:string, file: TFile) => {
            if(node.file) {
              (node.file.extension === "pdf")
                ? node.canvas.createFileNode({pos:{x:node.x + node.width + 10,y: node.y}, file})
                : node.setFile(file);
            }
            if(node.url) {
              node.canvas.createFileNode({pos:{x:node.x + 20,y: node.y+20}, file});
            }
          }
          carveout(Boolean(node.file), canvasView.file, node.file, node.url, replacer, page ? `page=${page}` : undefined);
        }

        if (markdownView) {
          const editor = markdownView.editor;
          const cursor = editor.getCursor();
          const line = editor.getLine(cursor.line);
          const parts = REGEX_LINK.getResList(line);
          if(parts.length === 0) return false;
          let imgpath = REGEX_LINK.getLink(parts[0]);
          const isWikilink = REGEX_LINK.isWikiLink(parts[0]);
          let alias = REGEX_LINK.getAliasOrLink(parts[0]);
          if(alias === imgpath) alias = null;
          imgpath = decodeURI(imgpath);
          const imagePathParts = imgpath.split("#");
          const hasRef = imagePathParts.length === 2;
          const imageFile = this.app.metadataCache.getFirstLinkpathDest(
            hasRef ? imagePathParts[0] : imgpath,
            markdownView.file.path
          );
          const isFile = (imageFile && imageFile instanceof TFile);
          const isExcalidraw = isFile ? this.isExcalidrawFile(imageFile) : false;
          let imagepath = isFile ? imageFile.path : "";
          let extension = isFile ? imageFile.extension : "";
          if(imgpath.match(/^https?|file/)) {
            imagepath = imgpath;
            extension = getURLImageExtension(imgpath);
          }
          if(imagepath === "") return false;
          if(extension !== "pdf" && !IMAGE_TYPES.contains(extension) && !isExcalidraw) return false;
          if(checking) return true;
          const ref = imagePathParts[1];
          const replacer = (link:string, _:TFile, size:string) => {
            const lineparts = line.split(parts[0].value[0]) 
            const pdfLink = isFile && ref 
              ? "\n" + getLink(this.plugin ,{
                  embed: false,
                  alias: getAliasWithSize(alias ?? `${imageFile.basename}, ${ref.replace("="," ")}`,size),
                  path:`${imageFile.path}#${ref}`
                }, isWikilink) 
              : "";
            editor.setLine(
              cursor.line,
              lineparts[0] + getLink(this.plugin ,{embed: true, path:link, alias: getAliasWithSize(alias,size)}, isWikilink) + pdfLink + lineparts[1]
            );
          }
          carveout(isFile, markdownView.file, imageFile, imagepath, replacer, ref);
        }
      }
    })

    this.addCommand({
      id: "insert-image",
      name: t("INSERT_IMAGE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          this.insertImageDialog.start(view);
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "import-svg",
      name: t("IMPORT_SVG"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          this.importSVGDialog.start(view);
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "release-notes",
      name: t("READ_RELEASE_NOTES"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        new ReleaseNotes(this.app, this.plugin, PLUGIN_VERSION).open();
        return true;
      },
    });

    this.addCommand({
      id: "tray-mode",
      name: t("TRAY_MODE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
          if (!view || !view.excalidrawAPI) {
            return false;
          }
          const st = view.excalidrawAPI.getAppState();
          if (st.zenModeEnabled || st.viewModeEnabled) {
            return false;
          }
          return true;
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view && view.excalidrawAPI) {
          view.toggleTrayMode();
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
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          this.insertMDDialog.start(view);
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-pdf",
      name: t("INSERT_PDF"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          const insertPDFModal = new InsertPDFModal(this.plugin, view);
          insertPDFModal.open();
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "insert-pdf",
      name: t("INSERT_LAST_ACTIVE_PDF_PAGE_AS_IMAGE"),
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if(!Boolean(view)) return false;
        const PDFLink = this.plugin.getLastActivePDFPageLink(view.file);
        if(!PDFLink) return false;
        if(checking) return true;
        const ea = getEA(view);
        insertImageToView(
          ea,
          view.currentPosition,
          PDFLink,
          undefined,
          undefined,
          true,
        );
      },
    });

    this.addCommand({
      id: "universal-add-file",
      name: t("UNIVERSAL_ADD_FILE"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          const insertFileModal = new UniversalInsertFileModal(this.plugin, view);
          insertFileModal.open();
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "universal-card",
      name: t("INSERT_CARD"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          view.insertBackOfTheNoteCard();
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
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView));
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          insertLaTeXToView(view);
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
            Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView))
          ) {
            return !(this.app.workspace.getActiveViewOfType(ExcalidrawView))
              .compatibilityMode;
          }
          return fileIsExcalidraw;
        }

        const excalidrawView = this.app.workspace.getActiveViewOfType(ExcalidrawView)
        if (excalidrawView) {
          excalidrawView.openAsMarkdown();
          return;
        }

        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView)
        if (markdownView && fileIsExcalidraw) {
          (async()=>{
            await markdownView.save();
            const activeLeaf = markdownView.leaf;
            this.plugin.excalidrawFileModes[(activeLeaf as any).id || activeFile.path] =
              VIEW_TYPE_EXCALIDRAW;
            setExcalidrawView(activeLeaf);
          })()
          return;
        }
      },
    });

    this.addCommand({
      id: "convert-to-excalidraw",
      name: t("CONVERT_NOTE_TO_EXCALIDRAW"),
      checkCallback: (checking) => {
        const activeFile = this.app.workspace.getActiveFile();
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

        if (!activeFile || !activeView) {
          return false;
        }

        if(this.isExcalidrawFile(activeFile)) {
          return false;
        }

        if(checking) {
          return true;
        }

        (async () => {
          await activeView.save();
          const template = await this.plugin.getBlankDrawing();
          const target = await this.app.vault.read(activeFile);
          const mergedTarget = mergeMarkdownFiles(template, target);
          await this.app.vault.modify(
            activeFile,
            mergedTarget,
          );
          setExcalidrawView(activeView.leaf);
        })();
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
        this.plugin.convertExcalidrawToMD();
        return true;
      },
    });
  }
}