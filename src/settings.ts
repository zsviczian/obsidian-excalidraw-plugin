import { App, DropdownComponent, normalizePath, PluginSettingTab, Setting } from "obsidian";
import { VIEW_TYPE_EXCALIDRAW } from "./constants";
import ExcalidrawView from "./ExcalidrawView";
import { t } from "./lang/helpers";
import type ExcalidrawPlugin from "./main";

export interface ExcalidrawSettings {
  folder: string;
  templateFilePath: string;
  scriptFolderPath: string;
  drawingFilenamePrefix: string;
  drawingFilenameDateTime: string;
  displaySVGInPreview: boolean;
  previewMatchObsidianTheme: boolean;
  width: string;
  matchTheme: boolean;
  matchThemeAlways: boolean;
  matchThemeTrigger: boolean;
  defaultMode: string;
  zoomToFitOnResize: boolean;
  zoomToFitMaxLevel: number;
  openInAdjacentPane: boolean;
  showLinkBrackets: boolean;
  linkPrefix: string;
  urlPrefix: string;
  allowCtrlClick: boolean; //if disabled only the link button in the view header will open links
  forceWrap: boolean;
  pageTransclusionCharLimit: number;
  iframelyAllowed: boolean;
  pngExportScale: number;
  exportWithTheme: boolean;
  exportWithBackground: boolean;
  keepInSync: boolean;
  autoexportSVG: boolean;
  autoexportPNG: boolean;
  autoexportExcalidraw: boolean;
  embedType: "excalidraw" | "PNG" | "SVG";
  syncExcalidraw: boolean;
  compatibilityMode: boolean;
  experimentalFileType: boolean;
  experimentalFileTag: string;
  loadCount: number; //version 1.2 migration counter
  drawingOpenCount: number;
  library: string;
  library2: {};
  patchCommentBlock: boolean; //1.3.12
  imageElementNotice: boolean; //1.4.0
  runWYSIWYGpatch: boolean; //1.4.9
  fixInfinitePreviewLoop: boolean; //1.4.10
  mdSVGwidth: number;
  mdSVGmaxHeight: number;
  mdFont: string;
  mdFontColor: string;
  mdCSS: string;
}

export const DEFAULT_SETTINGS: ExcalidrawSettings = {
  folder: "Excalidraw",
  templateFilePath: "Excalidraw/Template.excalidraw",
  scriptFolderPath: "Excalidraw/Scripts",
  drawingFilenamePrefix: "Drawing ",
  drawingFilenameDateTime: "YYYY-MM-DD HH.mm.ss",
  displaySVGInPreview: true,
  previewMatchObsidianTheme: false,
  width: "400",
  matchTheme: false,
  matchThemeAlways: false,
  matchThemeTrigger: false,
  defaultMode: "normal",
  zoomToFitOnResize: true,
  zoomToFitMaxLevel: 2,
  linkPrefix: "📍",
  urlPrefix: "🌐",
  openInAdjacentPane: false,
  showLinkBrackets: true,
  allowCtrlClick: true,
  forceWrap: false,
  pageTransclusionCharLimit: 200,
  iframelyAllowed: true,
  pngExportScale: 1,
  exportWithTheme: true,
  exportWithBackground: true,
  keepInSync: false,
  autoexportSVG: false,
  autoexportPNG: false,
  autoexportExcalidraw: false,
  embedType: "excalidraw",
  syncExcalidraw: false,
  experimentalFileType: false,
  experimentalFileTag: "✏️",
  compatibilityMode: false,
  loadCount: 0,
  drawingOpenCount: 0,
  library: `deprecated`,
  library2: {
    type: "excalidrawlib",
    version: 2,
    source: "https://excalidraw.com",
    libraryItems: [],
  },
  patchCommentBlock: true,
  imageElementNotice: true,
  runWYSIWYGpatch: true,
  fixInfinitePreviewLoop: true,
  mdSVGwidth: 500,
  mdSVGmaxHeight: 800,
  mdFont: "Virgil",
  mdFontColor: "Black",
  mdCSS: "",
};

export class ExcalidrawSettingTab extends PluginSettingTab {
  plugin: ExcalidrawPlugin;
  private requestEmbedUpdate: boolean = false;
  private requestReloadDrawings: boolean = false;
  private applyDebounceTimer: number = 0;

  constructor(app: App, plugin: ExcalidrawPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  applySettingsUpdate(requestReloadDrawings: boolean = false) {
    clearTimeout(this.applyDebounceTimer);
    const plugin = this.plugin;
    this.applyDebounceTimer = window.setTimeout(() => {
      plugin.saveSettings();
    }, 100);
    if (requestReloadDrawings) {
      this.requestReloadDrawings = true;
    }
  }

  async hide() {
    if (this.requestReloadDrawings) {
      const exs =
        this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
      for (const v of exs) {
        if (v.view instanceof ExcalidrawView) {
          await v.view.save(false);
          //debug({where:"ExcalidrawSettings.hide",file:v.view.file.name,before:"reload(true)"})
          await v.view.reload(true);
        }
      }
      this.requestEmbedUpdate = true;
    }
    if (this.requestEmbedUpdate) {
      this.plugin.triggerEmbedUpdates();
    }
    this.plugin.scriptEngine.updateScriptPath();
  }

  async display() {
    await this.plugin.loadSettings(); //in case sync loaded changed settings in the background
    this.requestEmbedUpdate = false;
    this.requestReloadDrawings = false;
    const { containerEl } = this;
    this.containerEl.empty();

    const coffeeDiv = containerEl.createDiv("coffee");
    coffeeDiv.addClass("ex-coffee-div");
    const coffeeLink = coffeeDiv.createEl("a", {
      href: "https://ko-fi.com/zsolt",
    });
    const coffeeImg = coffeeLink.createEl("img", {
      attr: {
        src: "https://cdn.ko-fi.com/cdn/kofi3.png?v=3",
      },
    });
    coffeeImg.height = 45;

    new Setting(containerEl)
      .setName(t("FOLDER_NAME"))
      .setDesc(t("FOLDER_DESC"))
      .addText((text) =>
        text
          .setPlaceholder("Excalidraw")
          .setValue(this.plugin.settings.folder)
          .onChange(async (value) => {
            this.plugin.settings.folder = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("TEMPLATE_NAME"))
      .setDesc(t("TEMPLATE_DESC"))
      .addText((text) =>
        text
          .setPlaceholder("Excalidraw/Template")
          .setValue(this.plugin.settings.templateFilePath)
          .onChange(async (value) => {
            this.plugin.settings.templateFilePath = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("SCRIPT_FOLDER_NAME"))
      .setDesc(t("SCRIPT_FOLDER_DESC"))
      .addText((text) =>
        text
          .setPlaceholder("Excalidraw/Scripts")
          .setValue(this.plugin.settings.scriptFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.scriptFolderPath =  normalizePath(value);
            this.applySettingsUpdate();
          }),
      );

    this.containerEl.createEl("h1", { text: t("FILENAME_HEAD") });
    containerEl.createDiv("", (el) => {
      el.innerHTML = t("FILENAME_DESC");
    });

    const getFilenameSample = () => {
      return `${
        t("FILENAME_SAMPLE") +
        this.plugin.settings.drawingFilenamePrefix +
        window.moment().format(this.plugin.settings.drawingFilenameDateTime)
      }</b>`;
    };

    const filenameEl = containerEl.createEl("p", { text: "" });
    filenameEl.innerHTML = getFilenameSample();

    new Setting(containerEl)
      .setName(t("FILENAME_PREFIX_NAME"))
      .setDesc(t("FILENAME_PREFIX_DESC"))
      .addText((text) =>
        text
          .setPlaceholder("Drawing ")
          .setValue(this.plugin.settings.drawingFilenamePrefix)
          .onChange(async (value) => {
            this.plugin.settings.drawingFilenamePrefix = value.replaceAll(
              /[<>:"/\\|?*]/g,
              "_",
            );
            text.setValue(this.plugin.settings.drawingFilenamePrefix);
            filenameEl.innerHTML = getFilenameSample();
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("FILENAME_DATE_NAME"))
      .setDesc(t("FILENAME_DATE_DESC"))
      .addText((text) =>
        text
          .setPlaceholder("YYYY-MM-DD HH.mm.ss")
          .setValue(this.plugin.settings.drawingFilenameDateTime)
          .onChange(async (value) => {
            this.plugin.settings.drawingFilenameDateTime = value.replaceAll(
              /[<>:"/\\|?*]/g,
              "_",
            );
            text.setValue(this.plugin.settings.drawingFilenameDateTime);
            filenameEl.innerHTML = getFilenameSample();
            this.applySettingsUpdate();
          }),
      );

    this.containerEl.createEl("h1", { text: t("DISPLAY_HEAD") });

    new Setting(containerEl)
      .setName(t("MATCH_THEME_NAME"))
      .setDesc(t("MATCH_THEME_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.matchTheme)
          .onChange(async (value) => {
            this.plugin.settings.matchTheme = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("MATCH_THEME_ALWAYS_NAME"))
      .setDesc(t("MATCH_THEME_ALWAYS_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.matchThemeAlways)
          .onChange(async (value) => {
            this.plugin.settings.matchThemeAlways = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("MATCH_THEME_TRIGGER_NAME"))
      .setDesc(t("MATCH_THEME_TRIGGER_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.matchThemeTrigger)
          .onChange(async (value) => {
            this.plugin.settings.matchThemeTrigger = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("DEFAULT_OPEN_MODE_NAME"))
      .setDesc(t("DEFAULT_OPEN_MODE_DESC"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("normal", "Normal Mode")
          .addOption("zen", "Zen Mode")
          .addOption("view", "View Mode")
          .setValue(this.plugin.settings.defaultMode)
          .onChange(async (value) => {
            this.plugin.settings.defaultMode = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("ZOOM_TO_FIT_NAME"))
      .setDesc(t("ZOOM_TO_FIT_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.zoomToFitOnResize)
          .onChange(async (value) => {
            this.plugin.settings.zoomToFitOnResize = value;
            this.applySettingsUpdate();
          }),
      );

    let zoomText: HTMLDivElement;

    new Setting(containerEl)
      .setName(t("ZOOM_TO_FIT_MAX_LEVEL_NAME"))
      .setDesc(t("ZOOM_TO_FIT_MAX_LEVEL_DESC"))
      .addSlider((slider) =>
        slider
          .setLimits(0.5, 10, 0.5)
          .setValue(this.plugin.settings.zoomToFitMaxLevel)
          .onChange(async (value) => {
            zoomText.innerText = ` ${value.toString()}`;
            this.plugin.settings.zoomToFitMaxLevel = value;
            this.applySettingsUpdate();
          }),
      )
      .settingEl.createDiv("", (el) => {
        zoomText = el;
        el.style.minWidth = "2.3em";
        el.style.textAlign = "right";
        el.innerText = ` ${this.plugin.settings.zoomToFitMaxLevel.toString()}`;
      });

    this.containerEl.createEl("h1", { text: t("LINKS_HEAD") });
    this.containerEl.createEl("p", { text: t("LINKS_DESC") });

    new Setting(containerEl)
      .setName(t("ADJACENT_PANE_NAME"))
      .setDesc(t("ADJACENT_PANE_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.openInAdjacentPane)
          .onChange(async (value) => {
            this.plugin.settings.openInAdjacentPane = value;
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(containerEl)
      .setName(t("LINK_BRACKETS_NAME"))
      .setDesc(t("LINK_BRACKETS_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showLinkBrackets)
          .onChange(async (value) => {
            this.plugin.settings.showLinkBrackets = value;
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(containerEl)
      .setName(t("LINK_PREFIX_NAME"))
      .setDesc(t("LINK_PREFIX_DESC"))
      .addText((text) =>
        text
          .setPlaceholder(t("INSERT_EMOJI"))
          .setValue(this.plugin.settings.linkPrefix)
          .onChange((value) => {
            this.plugin.settings.linkPrefix = value;
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(containerEl)
      .setName(t("URL_PREFIX_NAME"))
      .setDesc(t("URL_PREFIX_DESC"))
      .addText((text) =>
        text
          .setPlaceholder(t("INSERT_EMOJI"))
          .setValue(this.plugin.settings.urlPrefix)
          .onChange(async (value) => {
            this.plugin.settings.urlPrefix = value;
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(containerEl)
      .setName(t("LINK_CTRL_CLICK_NAME"))
      .setDesc(t("LINK_CTRL_CLICK_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.allowCtrlClick)
          .onChange(async (value) => {
            this.plugin.settings.allowCtrlClick = value;
            this.applySettingsUpdate();
          }),
      );

    const s = new Setting(containerEl)
      .setName(t("TRANSCLUSION_WRAP_NAME"))
      .setDesc(t("TRANSCLUSION_WRAP_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.forceWrap)
          .onChange(async (value) => {
            this.plugin.settings.forceWrap = value;
            this.applySettingsUpdate(true);
          }),
      );
    s.descEl.innerHTML = `<code>![[doc#^ref]]{number}</code> ${t(
      "TRANSCLUSION_WRAP_DESC",
    )}`;

    new Setting(containerEl)
      .setName(t("PAGE_TRANSCLUSION_CHARCOUNT_NAME"))
      .setDesc(t("PAGE_TRANSCLUSION_CHARCOUNT_DESC"))
      .addText((text) =>
        text
          .setPlaceholder("Enter a number")
          .setValue(this.plugin.settings.pageTransclusionCharLimit.toString())
          .onChange(async (value) => {
            const intVal = parseInt(value);
            if (isNaN(intVal) && value !== "") {
              text.setValue(
                this.plugin.settings.pageTransclusionCharLimit.toString(),
              );
              return;
            }
            this.requestEmbedUpdate = true;
            if (value === "") {
              this.plugin.settings.pageTransclusionCharLimit = 10;
              this.applySettingsUpdate(true);
              return;
            }
            this.plugin.settings.pageTransclusionCharLimit = intVal;
            text.setValue(
              this.plugin.settings.pageTransclusionCharLimit.toString(),
            );
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(containerEl)
      .setName(t("GET_URL_TITLE_NAME"))
      .setDesc(t("GET_URL_TITLE_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.iframelyAllowed)
          .onChange(async (value) => {
            this.plugin.settings.iframelyAllowed = value;
            this.applySettingsUpdate();
          }),
      );

    this.containerEl.createEl("h1", { text: t("MD_HEAD") });
    this.containerEl.createEl("p", { text: t("MD_HEAD_DESC") });

    new Setting(containerEl)
      .setName(t("MD_TRANSCLUDE_WIDTH_NAME"))
      .setDesc(t("MD_TRANSCLUDE_WIDTH_DESC"))
      .addText((text) =>
        text
          .setPlaceholder("Enter a number e.g. 500")
          .setValue(this.plugin.settings.mdSVGwidth.toString())
          .onChange(async (value) => {
            const intVal = parseInt(value);
            if (isNaN(intVal) && value !== "") {
              text.setValue(this.plugin.settings.mdSVGwidth.toString());
              return;
            }
            this.requestEmbedUpdate = true;
            if (value === "") {
              this.plugin.settings.mdSVGwidth = 500;
              this.applySettingsUpdate(true);
              return;
            }
            this.plugin.settings.mdSVGwidth = intVal;
            this.requestReloadDrawings = true;
            text.setValue(this.plugin.settings.mdSVGwidth.toString());
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(containerEl)
      .setName(t("MD_TRANSCLUDE_HEIGHT_NAME"))
      .setDesc(t("MD_TRANSCLUDE_HEIGHT_DESC"))
      .addText((text) =>
        text
          .setPlaceholder("Enter a number e.g. 800")
          .setValue(this.plugin.settings.mdSVGmaxHeight.toString())
          .onChange(async (value) => {
            const intVal = parseInt(value);
            if (isNaN(intVal) && value !== "") {
              text.setValue(this.plugin.settings.mdSVGmaxHeight.toString());
              return;
            }
            this.requestEmbedUpdate = true;
            if (value === "") {
              this.plugin.settings.mdSVGmaxHeight = 800;
              this.applySettingsUpdate(true);
              return;
            }
            this.plugin.settings.mdSVGmaxHeight = intVal;
            this.requestReloadDrawings = true;
            text.setValue(this.plugin.settings.mdSVGmaxHeight.toString());
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(containerEl)
      .setName(t("MD_DEFAULT_FONT_NAME"))
      .setDesc(t("MD_DEFAULT_FONT_DESC"))
      .addText((text) =>
        text
          .setPlaceholder("Virgil|Cascadia|Filename")
          .setValue(this.plugin.settings.mdFont)
          .onChange((value) => {
            this.requestReloadDrawings = true;
            this.plugin.settings.mdFont = value;
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(containerEl)
      .setName(t("MD_DEFAULT_COLOR_NAME"))
      .setDesc(t("MD_DEFAULT_COLOR_DESC"))
      .addText((text) =>
        text
          .setPlaceholder("CSS Color-name|RGB-HEX")
          .setValue(this.plugin.settings.mdFontColor)
          .onChange((value) => {
            this.requestReloadDrawings = true;
            this.plugin.settings.mdFontColor = value;
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(containerEl)
      .setName(t("MD_CSS_NAME"))
      .setDesc(t("MD_CSS_DESC"))
      .addText((text) =>
        text
          .setPlaceholder("filename of css file in vault")
          .setValue(this.plugin.settings.mdCSS)
          .onChange((value) => {
            this.requestReloadDrawings = true;
            this.plugin.settings.mdCSS = value;
            this.applySettingsUpdate(true);
          }),
      );

    this.containerEl.createEl("h1", { text: t("EMBED_HEAD") });

    new Setting(containerEl)
      .setName(t("EMBED_PREVIEW_SVG_NAME"))
      .setDesc(t("EMBED_PREVIEW_SVG_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.displaySVGInPreview)
          .onChange(async (value) => {
            this.plugin.settings.displaySVGInPreview = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("PREVIEW_MATCH_OBSIDIAN_NAME"))
      .setDesc(t("PREVIEW_MATCH_OBSIDIAN_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.previewMatchObsidianTheme)
          .onChange(async (value) => {
            this.plugin.settings.previewMatchObsidianTheme = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("EMBED_WIDTH_NAME"))
      .setDesc(t("EMBED_WIDTH_DESC"))
      .addText((text) =>
        text
          .setPlaceholder("400")
          .setValue(this.plugin.settings.width)
          .onChange(async (value) => {
            this.plugin.settings.width = value;
            this.applySettingsUpdate();
            this.requestEmbedUpdate = true;
          }),
      );

    let dropdown: DropdownComponent;

    new Setting(containerEl)
      .setName(t("EMBED_TYPE_NAME"))
      .setDesc(t("EMBED_TYPE_DESC"))
      .addDropdown(async (d: DropdownComponent) => {
        dropdown = d;
        dropdown.addOption("excalidraw", "excalidraw");
        if (this.plugin.settings.autoexportPNG) {
          dropdown.addOption("PNG", "PNG");
        } else if (this.plugin.settings.embedType === "PNG") {
          this.plugin.settings.embedType = "excalidraw";
          this.applySettingsUpdate();
        }
        if (this.plugin.settings.autoexportSVG) {
          dropdown.addOption("SVG", "SVG");
        } else if (this.plugin.settings.embedType === "SVG") {
          this.plugin.settings.embedType = "excalidraw";
          this.applySettingsUpdate();
        }
        dropdown
          .setValue(this.plugin.settings.embedType)
          .onChange(async (value) => {
            //@ts-ignore
            this.plugin.settings.embedType = value;
            this.applySettingsUpdate();
          });
      });

    let scaleText: HTMLDivElement;

    new Setting(containerEl)
      .setName(t("EXPORT_PNG_SCALE_NAME"))
      .setDesc(t("EXPORT_PNG_SCALE_DESC"))
      .addSlider((slider) =>
        slider
          .setLimits(1, 5, 0.5)
          .setValue(this.plugin.settings.pngExportScale)
          .onChange(async (value) => {
            scaleText.innerText = ` ${value.toString()}`;
            this.plugin.settings.pngExportScale = value;
            this.applySettingsUpdate();
          }),
      )
      .settingEl.createDiv("", (el) => {
        scaleText = el;
        el.style.minWidth = "2.3em";
        el.style.textAlign = "right";
        el.innerText = ` ${this.plugin.settings.pngExportScale.toString()}`;
      });

    new Setting(containerEl)
      .setName(t("EXPORT_BACKGROUND_NAME"))
      .setDesc(t("EXPORT_BACKGROUND_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.exportWithBackground)
          .onChange(async (value) => {
            this.plugin.settings.exportWithBackground = value;
            this.applySettingsUpdate();
            this.requestEmbedUpdate = true;
          }),
      );

    new Setting(containerEl)
      .setName(t("EXPORT_THEME_NAME"))
      .setDesc(t("EXPORT_THEME_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.exportWithTheme)
          .onChange(async (value) => {
            this.plugin.settings.exportWithTheme = value;
            this.applySettingsUpdate();
            this.requestEmbedUpdate = true;
          }),
      );

    this.containerEl.createEl("h1", { text: t("EXPORT_HEAD") });

    new Setting(containerEl)
      .setName(t("EXPORT_SYNC_NAME"))
      .setDesc(t("EXPORT_SYNC_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.keepInSync)
          .onChange(async (value) => {
            this.plugin.settings.keepInSync = value;
            this.applySettingsUpdate();
          }),
      );

    const removeDropdownOption = (opt: string) => {
      let i = 0;
      for (i = 0; i < dropdown.selectEl.options.length; i++) {
        if ((dropdown.selectEl.item(i) as HTMLOptionElement).label === opt) {
          dropdown.selectEl.item(i).remove();
        }
      }
    };

    new Setting(containerEl)
      .setName(t("EXPORT_SVG_NAME"))
      .setDesc(t("EXPORT_SVG_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoexportSVG)
          .onChange(async (value) => {
            if (value) {
              dropdown.addOption("SVG", "SVG");
            } else {
              if (this.plugin.settings.embedType === "SVG") {
                dropdown.setValue("excalidraw");
                this.plugin.settings.embedType = "excalidraw";
              }
              removeDropdownOption("SVG");
            }
            this.plugin.settings.autoexportSVG = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("EXPORT_PNG_NAME"))
      .setDesc(t("EXPORT_PNG_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoexportPNG)
          .onChange(async (value) => {
            if (value) {
              dropdown.addOption("PNG", "PNG");
            } else {
              if (this.plugin.settings.embedType === "PNG") {
                dropdown.setValue("excalidraw");
                this.plugin.settings.embedType = "excalidraw";
              }
              removeDropdownOption("PNG");
            }
            this.plugin.settings.autoexportPNG = value;
            this.applySettingsUpdate();
          }),
      );

    this.containerEl.createEl("h1", { text: t("COMPATIBILITY_HEAD") });

    new Setting(containerEl)
      .setName(t("COMPATIBILITY_MODE_NAME"))
      .setDesc(t("COMPATIBILITY_MODE_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.compatibilityMode)
          .onChange(async (value) => {
            this.plugin.settings.compatibilityMode = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("EXPORT_EXCALIDRAW_NAME"))
      .setDesc(t("EXPORT_EXCALIDRAW_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoexportExcalidraw)
          .onChange(async (value) => {
            this.plugin.settings.autoexportExcalidraw = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("SYNC_EXCALIDRAW_NAME"))
      .setDesc(t("SYNC_EXCALIDRAW_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncExcalidraw)
          .onChange(async (value) => {
            this.plugin.settings.syncExcalidraw = value;
            this.applySettingsUpdate();
          }),
      );

    this.containerEl.createEl("h1", { text: t("EXPERIMENTAL_HEAD") });
    this.containerEl.createEl("p", { text: t("EXPERIMENTAL_DESC") });

    new Setting(containerEl)
      .setName(t("FILETYPE_NAME"))
      .setDesc(t("FILETYPE_DESC"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.experimentalFileType)
          .onChange(async (value) => {
            this.plugin.settings.experimentalFileType = value;
            this.plugin.experimentalFileTypeDisplayToggle(value);
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("FILETAG_NAME"))
      .setDesc(t("FILETAG_DESC"))
      .addText((text) =>
        text
          .setPlaceholder(t("INSERT_EMOJI"))
          .setValue(this.plugin.settings.experimentalFileTag)
          .onChange(async (value) => {
            this.plugin.settings.experimentalFileTag = value;
            this.applySettingsUpdate();
          }),
      );
  }
}
