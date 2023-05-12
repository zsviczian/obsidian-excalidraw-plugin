import {
  App,
  DropdownComponent,
  normalizePath,
  PluginSettingTab,
  Setting,
  TextComponent,
  TFile,
} from "obsidian";
import { GITHUB_RELEASES, VIEW_TYPE_EXCALIDRAW } from "./Constants";
import ExcalidrawView from "./ExcalidrawView";
import { t } from "./lang/helpers";
import type ExcalidrawPlugin from "./main";
import { PenStyle } from "./PenTypes";
import { DynamicStyle } from "./types";
import { setDynamicStyle } from "./utils/DynamicStyling";
import {
  getDrawingFilename,
  getEmbedFilename,
} from "./utils/FileUtils";
import { PENS } from "./utils/Pens";
import {
  fragWithHTML,
  setLeftHandedMode,
} from "./utils/Utils";

export interface ExcalidrawSettings {
  folder: string;
  embedUseExcalidrawFolder: boolean;
  templateFilePath: string;
  scriptFolderPath: string;
  compress: boolean;
  autosave: boolean;
  autosaveInterval: number;
  autosaveIntervalDesktop: number;
  autosaveIntervalMobile: number;
  drawingFilenamePrefix: string;
  drawingEmbedPrefixWithFilename: boolean;
  drawingFilnameEmbedPostfix: string;
  drawingFilenameDateTime: string;
  useExcalidrawExtension: boolean;
  displaySVGInPreview: boolean;
  displayExportedImageIfAvailable: boolean;
  previewMatchObsidianTheme: boolean;
  width: string;
  dynamicStyling: DynamicStyle;
  isLeftHanded: boolean;
  matchTheme: boolean;
  matchThemeAlways: boolean;
  matchThemeTrigger: boolean;
  defaultMode: string;
  defaultPenMode: "never" | "mobile" | "always";
  allowPinchZoom: boolean;
  allowWheelZoom: boolean;
  zoomToFitOnOpen: boolean;
  zoomToFitOnResize: boolean;
  zoomToFitMaxLevel: number;
  openInAdjacentPane: boolean;
  openInMainWorkspace: boolean;
  showLinkBrackets: boolean;
  linkPrefix: string;
  urlPrefix: string;
  parseTODO: boolean;
  todo: string;
  done: string;
  hoverPreviewWithoutCTRL: boolean;
  linkOpacity: number;
  allowCtrlClick: boolean; //if disabled only the link button in the view header will open links
  forceWrap: boolean;
  pageTransclusionCharLimit: number;
  wordWrappingDefault: number;
  removeTransclusionQuoteSigns: boolean;
  iframelyAllowed: boolean;
  pngExportScale: number;
  exportWithTheme: boolean;
  exportWithBackground: boolean;
  exportPaddingSVG: number;
  keepInSync: boolean;
  autoexportSVG: boolean;
  autoexportPNG: boolean;
  autoExportLightAndDark: boolean;
  autoexportExcalidraw: boolean;
  embedType: "excalidraw" | "PNG" | "SVG";
  embedWikiLink: boolean;
  syncExcalidraw: boolean;
  compatibilityMode: boolean;
  experimentalFileType: boolean;
  experimentalFileTag: string;
  experimentalLivePreview: boolean;
  experimentalEnableFourthFont: boolean;
  experimantalFourthFont: string;
  fieldSuggester: boolean;
  //loadCount: number; //version 1.2 migration counter
  drawingOpenCount: number;
  library: string;
  library2: {};
  //patchCommentBlock: boolean; //1.3.12
  imageElementNotice: boolean; //1.4.0
  //runWYSIWYGpatch: boolean; //1.4.9
  //fixInfinitePreviewLoop: boolean; //1.4.10
  mdSVGwidth: number;
  mdSVGmaxHeight: number;
  mdFont: string;
  mdFontColor: string;
  mdBorderColor: string;
  mdCSS: string;
  scriptEngineSettings: {
    [key:string]: {
      [key:string]: {
        value?:string,
        hidden?: boolean,
        description?: string,
        valueset?: string[],
        height?: number,
      }
    }
  };
  defaultTrayMode: boolean;
  previousRelease: string;
  showReleaseNotes: boolean;
  showNewVersionNotification: boolean;
  mathjaxSourceURL: string;
  latexBoilerplate: string;
  taskboneEnabled: boolean;
  taskboneAPIkey: string;
  pinnedScripts: string[];
  customPens: PenStyle[];
  numberOfCustomPens: number;
  pdfScale: number;
  pdfBorderBox: boolean;
  pdfGapSize: number;
  pdfLockAfterImport: boolean;
  pdfNumColumns: number;
  pdfImportScale: number;
}

declare const PLUGIN_VERSION:string;

export const DEFAULT_SETTINGS: ExcalidrawSettings = {
  folder: "Excalidraw",
  embedUseExcalidrawFolder: false,
  templateFilePath: "Excalidraw/Template.excalidraw",
  scriptFolderPath: "Excalidraw/Scripts",
  compress: false,
  autosave: true,
  autosaveInterval: 15000,
  autosaveIntervalDesktop: 15000,
  autosaveIntervalMobile: 10000,
  drawingFilenamePrefix: "Drawing ",
  drawingEmbedPrefixWithFilename: true,
  drawingFilnameEmbedPostfix: " ",
  drawingFilenameDateTime: "YYYY-MM-DD HH.mm.ss",
  useExcalidrawExtension: true,
  displaySVGInPreview: true,
  displayExportedImageIfAvailable: false,
  previewMatchObsidianTheme: false,
  width: "400",
  dynamicStyling: "colorful",
  isLeftHanded: false,
  matchTheme: false,
  matchThemeAlways: false,
  matchThemeTrigger: false,
  defaultMode: "normal",
  defaultPenMode: "never",
  allowPinchZoom: false,
  allowWheelZoom: false,
  zoomToFitOnOpen: true,
  zoomToFitOnResize: true,
  zoomToFitMaxLevel: 2,
  linkPrefix: "📍",
  urlPrefix: "🌐",
  parseTODO: false,
  todo: "☐",
  done: "🗹",
  hoverPreviewWithoutCTRL: false,
  linkOpacity: 1,
  openInAdjacentPane: false,
  openInMainWorkspace: true,
  showLinkBrackets: true,
  allowCtrlClick: true,
  forceWrap: false,
  pageTransclusionCharLimit: 200,
  wordWrappingDefault: 0,
  removeTransclusionQuoteSigns: true,
  iframelyAllowed: true,
  pngExportScale: 1,
  exportWithTheme: true,
  exportWithBackground: true,
  exportPaddingSVG: 10, //since 1.6.17, not only SVG but also PNG
  keepInSync: false,
  autoexportSVG: false,
  autoexportPNG: false,
  autoExportLightAndDark: false,
  autoexportExcalidraw: false,
  embedType: "excalidraw",
  embedWikiLink: true,
  syncExcalidraw: false,
  experimentalFileType: false,
  experimentalFileTag: "✏️",
  experimentalLivePreview: true,
  experimentalEnableFourthFont: false,
  experimantalFourthFont: "Virgil",
  fieldSuggester: true,
  compatibilityMode: false,
  //loadCount: 0,
  drawingOpenCount: 0,
  library: `deprecated`,
  library2: {
    type: "excalidrawlib",
    version: 2,
    source: GITHUB_RELEASES+PLUGIN_VERSION,
    libraryItems: [],
  },
  //patchCommentBlock: true,
  imageElementNotice: true,
  //runWYSIWYGpatch: true,
  //fixInfinitePreviewLoop: true,
  mdSVGwidth: 500,
  mdSVGmaxHeight: 800,
  mdFont: "Virgil",
  mdFontColor: "Black",
  mdBorderColor: "Black",
  mdCSS: "",
  scriptEngineSettings: {},
  defaultTrayMode: true,
  previousRelease: "0.0.0",
  showReleaseNotes: true,
  showNewVersionNotification: true,
  mathjaxSourceURL: "https://cdn.jsdelivr.net/npm/mathjax@3.2.1/es5/tex-svg.js",
  latexBoilerplate: "\\color{blue}",
  taskboneEnabled: false,
  taskboneAPIkey: "",
  pinnedScripts: [],
  customPens: [
    {...PENS["default"]},
    {...PENS["highlighter"]},
    {...PENS["finetip"]},
    {...PENS["fountain"]},
    {...PENS["marker"]},
    {...PENS["thick-thin"]},
    {...PENS["thin-thick-thin"]},
    {...PENS["default"]},
    {...PENS["default"]},
    {...PENS["default"]}
  ],
  numberOfCustomPens: 0,
  pdfScale: 4,
  pdfBorderBox: true,
  pdfGapSize: 20,
  pdfLockAfterImport: true,
  pdfNumColumns: 1,
  pdfImportScale: 0.3,
};

export class ExcalidrawSettingTab extends PluginSettingTab {
  plugin: ExcalidrawPlugin;
  private requestEmbedUpdate: boolean = false;
  private requestReloadDrawings: boolean = false;
  private requestUpdatePinnedPens: boolean = false;
  private requestUpdateDynamicStyling: boolean = false;
  private reloadMathJax: boolean = false;
  //private applyDebounceTimer: number = 0;

  constructor(app: App, plugin: ExcalidrawPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  applySettingsUpdate(requestReloadDrawings: boolean = false) {
    if (requestReloadDrawings) {
      this.requestReloadDrawings = true;
    }
  }

  async hide() {
    this.plugin.settings.scriptFolderPath = normalizePath(
      this.plugin.settings.scriptFolderPath,
    );
    if (
      this.plugin.settings.scriptFolderPath === "/" ||
      this.plugin.settings.scriptFolderPath === ""
    ) {
      this.plugin.settings.scriptFolderPath = "Excalidraw/Scripts";
    }
    this.plugin.saveSettings();
    if (this.requestUpdatePinnedPens) {
      app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW).forEach(v=> {
        if (v.view instanceof ExcalidrawView) v.view.updatePinnedCustomPens()
      })
    }
    if (this.requestUpdateDynamicStyling) {
      app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW).forEach(v=> {
        if (v.view instanceof ExcalidrawView) {
          setDynamicStyle(this.plugin.ea,v.view,v.view.previousBackgroundColor,this.plugin.settings.dynamicStyling);
        }
        
      })
    }
    if (this.requestReloadDrawings) {
      const exs =
        app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
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
    if(this.reloadMathJax) {
      this.plugin.loadMathJax();
    }
  }

  async display() {
    await this.plugin.loadSettings(); //in case sync loaded changed settings in the background
    this.requestEmbedUpdate = false;
    this.requestReloadDrawings = false;
    const { containerEl } = this;
    containerEl.addClass("excalidraw-settings");
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
      .setName(t("RELEASE_NOTES_NAME"))
      .setDesc(fragWithHTML(t("RELEASE_NOTES_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showReleaseNotes)
          .onChange(async (value) => {
            this.plugin.settings.showReleaseNotes = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
    .setName(t("NEWVERSION_NOTIFICATION_NAME"))
    .setDesc(fragWithHTML(t("NEWVERSION_NOTIFICATION_DESC")))
    .addToggle((toggle) =>
      toggle
        .setValue(this.plugin.settings.showNewVersionNotification)
        .onChange(async (value) => {
          this.plugin.settings.showNewVersionNotification = value;
          this.applySettingsUpdate();
        }),
    );

    new Setting(containerEl)
      .setName(t("FOLDER_NAME"))
      .setDesc(fragWithHTML(t("FOLDER_DESC")))
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
      .setName(t("FOLDER_EMBED_NAME"))
      .setDesc(fragWithHTML(t("FOLDER_EMBED_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.embedUseExcalidrawFolder)
          .onChange(async (value) => {
            this.plugin.settings.embedUseExcalidrawFolder = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("TEMPLATE_NAME"))
      .setDesc(fragWithHTML(t("TEMPLATE_DESC")))
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
      .setDesc(fragWithHTML(t("SCRIPT_FOLDER_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("Excalidraw/Scripts")
          .setValue(this.plugin.settings.scriptFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.scriptFolderPath = value;
            this.applySettingsUpdate();
          }),
      );

    this.containerEl.createEl("h1", { text: t("SAVING_HEAD") });

    new Setting(containerEl)
      .setName(t("COMPRESS_NAME"))
      .setDesc(fragWithHTML(t("COMPRESS_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.compress)
          .onChange(async (value) => {
            this.plugin.settings.compress = value;
            this.applySettingsUpdate();
          }),
    );

    new Setting(containerEl)
    .setName(t("AUTOSAVE_INTERVAL_DESKTOP_NAME"))
    .setDesc(fragWithHTML(t("AUTOSAVE_INTERVAL_DESKTOP_DESC")))
    .addDropdown((dropdown) =>
      dropdown
        .addOption("15000", "Frequent (every 15 seconds)")
        .addOption("60000", "Moderate (every 60 seconds)")
        .addOption("300000", "Rare (every 5 minutes)")
        .addOption("900000", "Practically never (every 15 minutes)")
        .setValue(this.plugin.settings.autosaveIntervalDesktop.toString())
        .onChange(async (value) => {
          this.plugin.settings.autosaveIntervalDesktop = parseInt(value);
          this.plugin.settings.autosaveInterval = app.isMobile
            ? this.plugin.settings.autosaveIntervalMobile
            : this.plugin.settings.autosaveIntervalDesktop;
          this.applySettingsUpdate();
        }),
    );

    new Setting(containerEl)
    .setName(t("AUTOSAVE_INTERVAL_MOBILE_NAME"))
    .setDesc(fragWithHTML(t("AUTOSAVE_INTERVAL_MOBILE_DESC")))
    .addDropdown((dropdown) =>
      dropdown
        .addOption("10000", "Frequent (every 10 seconds)")
        .addOption("30000", "Moderate (every 30 seconds)")
        .addOption("60000", "Rare (every 1 minute)")
        .addOption("300000", "Practically never (every 5 minutes)")
        .setValue(this.plugin.settings.autosaveIntervalMobile.toString())
        .onChange(async (value) => {
          this.plugin.settings.autosaveIntervalMobile = parseInt(value);
          this.plugin.settings.autosaveInterval = app.isMobile
            ? this.plugin.settings.autosaveIntervalMobile
            : this.plugin.settings.autosaveIntervalDesktop;
          this.applySettingsUpdate();
        }),
    );

    this.containerEl.createEl("h1", { text: t("FILENAME_HEAD") });
    containerEl.createDiv("", (el) => {
      el.innerHTML = t("FILENAME_DESC");
    });

    const getFilenameSample = () => {
      return `${t(
        "FILENAME_SAMPLE",
      )}<a href='https://www.youtube.com/channel/UCC0gns4a9fhVkGkngvSumAQ' target='_blank'>${getDrawingFilename(
        this.plugin.settings,
      )}</a></b><br>${t(
        "FILENAME_EMBED_SAMPLE",
      )}<a href='https://www.youtube.com/channel/UCC0gns4a9fhVkGkngvSumAQ' target='_blank'>${getEmbedFilename(
        "{NOTE_NAME}",
        this.plugin.settings,
      )}</a></b>`;
    };

    const filenameEl = containerEl.createEl("p", { text: "" });
    filenameEl.innerHTML = getFilenameSample();

    new Setting(containerEl)
      .setName(t("FILENAME_PREFIX_NAME"))
      .setDesc(fragWithHTML(t("FILENAME_PREFIX_DESC")))
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
      .setName(t("FILENAME_PREFIX_EMBED_NAME"))
      .setDesc(fragWithHTML(t("FILENAME_PREFIX_EMBED_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.drawingEmbedPrefixWithFilename)
          .onChange(async (value) => {
            this.plugin.settings.drawingEmbedPrefixWithFilename = value;
            filenameEl.innerHTML = getFilenameSample();
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("FILENAME_POSTFIX_NAME"))
      .setDesc(fragWithHTML(t("FILENAME_POSTFIX_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("")
          .setValue(this.plugin.settings.drawingFilnameEmbedPostfix)
          .onChange(async (value) => {
            this.plugin.settings.drawingFilnameEmbedPostfix = value.replaceAll(
              /[<>:"/\\|?*]/g,
              "_",
            );
            text.setValue(this.plugin.settings.drawingFilnameEmbedPostfix);
            filenameEl.innerHTML = getFilenameSample();
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("FILENAME_DATE_NAME"))
      .setDesc(fragWithHTML(t("FILENAME_DATE_DESC")))
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

    new Setting(containerEl)
      .setName(t("FILENAME_EXCALIDRAW_EXTENSION_NAME"))
      .setDesc(fragWithHTML(t("FILENAME_EXCALIDRAW_EXTENSION_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.useExcalidrawExtension)
          .onChange(async (value) => {
            this.plugin.settings.useExcalidrawExtension = value;
            filenameEl.innerHTML = getFilenameSample();
            this.applySettingsUpdate();
          }),
      );

    this.containerEl.createEl("h1", { text: t("DISPLAY_HEAD") });

    new Setting(containerEl)
      .setName(t("DYNAMICSTYLE_NAME"))
      .setDesc(fragWithHTML(t("DYNAMICSTYLE_DESC")))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("none","Dynamic Styling OFF")
          .addOption("colorful","Match color")
          .addOption("gray","Gray, match tone")
          .setValue(this.plugin.settings.dynamicStyling)
          .onChange(async (value) => {
            this.requestUpdateDynamicStyling = true;
            this.plugin.settings.dynamicStyling = value as DynamicStyle;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("LEFTHANDED_MODE_NAME"))
      .setDesc(fragWithHTML(t("LEFTHANDED_MODE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.isLeftHanded)
          .onChange(async (value) => {
            this.plugin.settings.isLeftHanded = value;
            //not clear why I need to do this. If I don't double apply the stylesheet changes 
            //then the style won't be applied in the popout windows
            setLeftHandedMode(value); 
            setTimeout(()=>setLeftHandedMode(value));
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("MATCH_THEME_NAME"))
      .setDesc(fragWithHTML(t("MATCH_THEME_DESC")))
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
      .setDesc(fragWithHTML(t("MATCH_THEME_ALWAYS_DESC")))
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
      .setDesc(fragWithHTML(t("MATCH_THEME_TRIGGER_DESC")))
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
      .setDesc(fragWithHTML(t("DEFAULT_OPEN_MODE_DESC")))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("normal", "Always in normal-mode")
          .addOption("zen", "Always in zen-mode")
          .addOption("view", "Always in view-mode")
          .addOption("view-mobile", "Usually normal, but view-mode on Phone")
          .setValue(this.plugin.settings.defaultMode)
          .onChange(async (value) => {
            this.plugin.settings.defaultMode = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("DEFAULT_PEN_MODE_NAME"))
      .setDesc(fragWithHTML(t("DEFAULT_PEN_MODE_DESC")))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("never", "Never")
          .addOption("mobile", "On Obsidian Mobile")
          .addOption("always", "Always")
          .setValue(this.plugin.settings.defaultPenMode)
          .onChange(async (value: "never" | "always" | "mobile") => {
            this.plugin.settings.defaultPenMode = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("DEFAULT_PINCHZOOM_NAME"))
      .setDesc(fragWithHTML(t("DEFAULT_PINCHZOOM_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.allowPinchZoom)
          .onChange(async (value) => {
            this.plugin.settings.allowPinchZoom = value;
            app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW).forEach(v=> {
              if (v.view instanceof ExcalidrawView) v.view.updatePinchZoom()
            })
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("DEFAULT_WHEELZOOM_NAME"))
      .setDesc(fragWithHTML(t("DEFAULT_WHEELZOOM_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.allowWheelZoom)
          .onChange(async (value) => {
            this.plugin.settings.allowWheelZoom = value;
            app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW).forEach(v=> {
              if (v.view instanceof ExcalidrawView) v.view.updateWheelZoom()
            })
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("ZOOM_TO_FIT_ONOPEN_NAME"))
      .setDesc(fragWithHTML(t("ZOOM_TO_FIT_ONOPEN_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.zoomToFitOnOpen)
          .onChange(async (value) => {
            this.plugin.settings.zoomToFitOnOpen = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("ZOOM_TO_FIT_NAME"))
      .setDesc(fragWithHTML(t("ZOOM_TO_FIT_DESC")))
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
      .setDesc(fragWithHTML(t("ZOOM_TO_FIT_MAX_LEVEL_DESC")))
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
    this.containerEl.createEl(
      "span",
      undefined,
      (el) => (el.innerHTML = t("LINKS_DESC")),
    );

    new Setting(containerEl)
      .setName(t("ADJACENT_PANE_NAME"))
      .setDesc(fragWithHTML(t("ADJACENT_PANE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.openInAdjacentPane)
          .onChange(async (value) => {
            this.plugin.settings.openInAdjacentPane = value;
            this.applySettingsUpdate();
          }),
      );

    
    new Setting(containerEl)
      .setName(t("MAINWORKSPACE_PANE_NAME"))
      .setDesc(fragWithHTML(t("MAINWORKSPACE_PANE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.openInMainWorkspace)
          .onChange(async (value) => {
            this.plugin.settings.openInMainWorkspace = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(fragWithHTML(t("LINK_BRACKETS_NAME")))
      .setDesc(fragWithHTML(t("LINK_BRACKETS_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showLinkBrackets)
          .onChange(value => {
            this.plugin.settings.showLinkBrackets = value;
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(containerEl)
      .setName(t("LINK_PREFIX_NAME"))
      .setDesc(fragWithHTML(t("LINK_PREFIX_DESC")))
      .addText((text) =>
        text
          .setPlaceholder(t("INSERT_EMOJI"))
          .setValue(this.plugin.settings.linkPrefix)
          .onChange(value => {
            this.plugin.settings.linkPrefix = value;
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(containerEl)
      .setName(t("URL_PREFIX_NAME"))
      .setDesc(fragWithHTML(t("URL_PREFIX_DESC")))
      .addText((text) =>
        text
          .setPlaceholder(t("INSERT_EMOJI"))
          .setValue(this.plugin.settings.urlPrefix)
          .onChange(value => {
            this.plugin.settings.urlPrefix = value;
            this.applySettingsUpdate(true);
          }),
      );

    let todoPrefixSetting:TextComponent, donePrefixSetting:TextComponent;
    
    new Setting(containerEl)
      .setName(t("PARSE_TODO_NAME"))
      .setDesc(fragWithHTML(t("PARSE_TODO_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.parseTODO)
          .onChange(value => {
            this.plugin.settings.parseTODO = value;
            todoPrefixSetting.setDisabled(!value);
            donePrefixSetting.setDisabled(!value);
            this.applySettingsUpdate(true);
          })
      );

    new Setting(containerEl)
      .setName(t("TODO_NAME"))
      .setDesc(fragWithHTML(t("TODO_DESC")))
      .addText((text) => {
        todoPrefixSetting = text;
        text
          .setPlaceholder(t("INSERT_EMOJI"))
          .setValue(this.plugin.settings.todo)
          .onChange(value => {
            this.plugin.settings.todo = value;
            this.applySettingsUpdate(true);
          })
        }
      );
    todoPrefixSetting.setDisabled(!this.plugin.settings.parseTODO);

    new Setting(containerEl)
      .setName(t("DONE_NAME"))
      .setDesc(fragWithHTML(t("DONE_DESC")))
      .setDisabled(!this.plugin.settings.parseTODO)
      .addText((text) => {
        donePrefixSetting = text;
        text
          .setPlaceholder(t("INSERT_EMOJI"))
          .setValue(this.plugin.settings.done)
          .onChange(value => {
            this.plugin.settings.done = value;
            this.applySettingsUpdate(true);
          })
        }
      );
    donePrefixSetting.setDisabled(!this.plugin.settings.parseTODO);

    let opacityText: HTMLDivElement;
    new Setting(containerEl)
      .setName(t("LINKOPACITY_NAME"))
      .setDesc(fragWithHTML(t("LINKOPACITY_DESC")))
      .addSlider((slider) =>
        slider
          .setLimits(0, 1, 0.05)
          .setValue(this.plugin.settings.linkOpacity)
          .onChange(async (value) => {
            opacityText.innerText = ` ${value.toString()}`;
            this.plugin.settings.linkOpacity = value;
            this.applySettingsUpdate(true);
          }),
      )
      .settingEl.createDiv("", (el) => {
        opacityText = el;
        el.style.minWidth = "2.3em";
        el.style.textAlign = "right";
        el.innerText = ` ${this.plugin.settings.linkOpacity.toString()}`;
      });

    new Setting(containerEl)
      .setName(t("HOVERPREVIEW_NAME"))
      .setDesc(fragWithHTML(t("HOVERPREVIEW_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.hoverPreviewWithoutCTRL)
          .onChange(async (value) => {
            this.plugin.settings.hoverPreviewWithoutCTRL = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("LINK_CTRL_CLICK_NAME"))
      .setDesc(fragWithHTML(t("LINK_CTRL_CLICK_DESC")))
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
      .setDesc(fragWithHTML(t("TRANSCLUSION_WRAP_DESC")))
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
      .setDesc(fragWithHTML(t("PAGE_TRANSCLUSION_CHARCOUNT_DESC")))
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
      .setName(t("TRANSCLUSION_DEFAULT_WRAP_NAME"))
      .setDesc(fragWithHTML(t("TRANSCLUSION_DEFAULT_WRAP_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("Enter a number")
          .setValue(this.plugin.settings.wordWrappingDefault.toString())
          .onChange(async (value) => {
            const intVal = parseInt(value);
            if (isNaN(intVal) && value !== "") {
              text.setValue(
                this.plugin.settings.wordWrappingDefault.toString(),
              );
              return;
            }
            this.requestEmbedUpdate = true;
            if (value === "") {
              this.plugin.settings.wordWrappingDefault = 0;
              this.applySettingsUpdate(true);
              return;
            }
            this.plugin.settings.wordWrappingDefault = intVal;
            text.setValue(this.plugin.settings.wordWrappingDefault.toString());
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(containerEl)
      .setName(t("QUOTE_TRANSCLUSION_REMOVE_NAME"))
      .setDesc(fragWithHTML(t("QUOTE_TRANSCLUSION_REMOVE_DESC")))
      .addToggle(toggle => 
        toggle
          .setValue(this.plugin.settings.removeTransclusionQuoteSigns)
          .onChange(value => {
            this.plugin.settings.removeTransclusionQuoteSigns = value;
            this.requestEmbedUpdate = true;
            this.applySettingsUpdate(true);
          })
      );

    new Setting(containerEl)
      .setName(t("GET_URL_TITLE_NAME"))
      .setDesc(fragWithHTML(t("GET_URL_TITLE_DESC")))
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
      .setDesc(fragWithHTML(t("MD_TRANSCLUDE_WIDTH_DESC")))
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
      .setDesc(fragWithHTML(t("MD_TRANSCLUDE_HEIGHT_DESC")))
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
      .setDesc(fragWithHTML(t("MD_DEFAULT_FONT_DESC")))
      .addDropdown(async (d: DropdownComponent) => {
        d.addOption("Virgil", "Virgil");
        d.addOption("Cascadia", "Cascadia");
        this.app.vault
          .getFiles()
          .filter((f) => ["ttf", "woff", "woff2"].contains(f.extension))
          .forEach((f: TFile) => {
            d.addOption(f.path, f.name);
          });
        d.setValue(this.plugin.settings.mdFont).onChange((value) => {
          this.requestReloadDrawings = true;
          this.plugin.settings.mdFont = value;
          this.applySettingsUpdate(true);
        });
      });

    new Setting(containerEl)
      .setName(t("MD_DEFAULT_COLOR_NAME"))
      .setDesc(fragWithHTML(t("MD_DEFAULT_COLOR_DESC")))
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
      .setName(t("MD_DEFAULT_BORDER_COLOR_NAME"))
      .setDesc(fragWithHTML(t("MD_DEFAULT_BORDER_COLOR_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("CSS Color-name|RGB-HEX")
          .setValue(this.plugin.settings.mdBorderColor)
          .onChange((value) => {
            this.requestReloadDrawings = true;
            this.plugin.settings.mdBorderColor = value;
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(containerEl)
      .setName(t("MD_CSS_NAME"))
      .setDesc(fragWithHTML(t("MD_CSS_DESC")))
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
      .setDesc(fragWithHTML(t("EMBED_PREVIEW_SVG_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.displaySVGInPreview)
          .onChange(async (value) => {
            this.plugin.settings.displaySVGInPreview = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("EMBED_REUSE_EXPORTED_IMAGE_NAME"))
      .setDesc(fragWithHTML(t("EMBED_REUSE_EXPORTED_IMAGE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.displayExportedImageIfAvailable)
          .onChange(async (value) => {
            this.plugin.settings.displayExportedImageIfAvailable = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("PREVIEW_MATCH_OBSIDIAN_NAME"))
      .setDesc(fragWithHTML(t("PREVIEW_MATCH_OBSIDIAN_DESC")))
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
      .setDesc(fragWithHTML(t("EMBED_WIDTH_DESC")))
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
      .setDesc(fragWithHTML(t("EMBED_TYPE_DESC")))
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

    new Setting(containerEl)
      .setName(t("EMBED_WIKILINK_NAME"))
      .setDesc(fragWithHTML(t("EMBED_WIKILINK_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.embedWikiLink)
          .onChange(async (value) => {
            this.plugin.settings.embedWikiLink = value;
            this.applySettingsUpdate();
          }),
      );

    let scaleText: HTMLDivElement;

    new Setting(containerEl)
      .setName(t("EXPORT_PNG_SCALE_NAME"))
      .setDesc(fragWithHTML(t("EXPORT_PNG_SCALE_DESC")))
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
      .setDesc(fragWithHTML(t("EXPORT_BACKGROUND_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.exportWithBackground)
          .onChange(async (value) => {
            this.plugin.settings.exportWithBackground = value;
            this.applySettingsUpdate();
            this.requestEmbedUpdate = true;
          }),
      );

    let exportPadding: HTMLDivElement;

    new Setting(containerEl)
      .setName(t("EXPORT_PADDING_NAME"))
      .setDesc(fragWithHTML(t("EXPORT_PADDING_DESC")))
      .addSlider((slider) =>
        slider
          .setLimits(0, 50, 5)
          .setValue(this.plugin.settings.exportPaddingSVG)
          .onChange(async (value) => {
            exportPadding.innerText = ` ${value.toString()}`;
            this.plugin.settings.exportPaddingSVG = value;
            this.applySettingsUpdate();
          }),
      )
      .settingEl.createDiv("", (el) => {
        exportPadding = el;
        el.style.minWidth = "2.3em";
        el.style.textAlign = "right";
        el.innerText = ` ${this.plugin.settings.exportPaddingSVG.toString()}`;
      });

    new Setting(containerEl)
      .setName(t("EXPORT_THEME_NAME"))
      .setDesc(fragWithHTML(t("EXPORT_THEME_DESC")))
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
      .setDesc(fragWithHTML(t("EXPORT_SYNC_DESC")))
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
      .setDesc(fragWithHTML(t("EXPORT_SVG_DESC")))
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
      .setDesc(fragWithHTML(t("EXPORT_PNG_DESC")))
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

    new Setting(containerEl)
      .setName(t("EXPORT_BOTH_DARK_AND_LIGHT_NAME"))
      .setDesc(fragWithHTML(t("EXPORT_BOTH_DARK_AND_LIGHT_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoExportLightAndDark)
          .onChange(async (value) => {
            this.plugin.settings.autoExportLightAndDark = value;
            this.applySettingsUpdate();
          }),
      );

    this.containerEl.createEl("h1", { text: t("COMPATIBILITY_HEAD") });

    new Setting(containerEl)
      .setName(t("COMPATIBILITY_MODE_NAME"))
      .setDesc(fragWithHTML(t("COMPATIBILITY_MODE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.compatibilityMode)
          .onChange(async (value) => {
            this.plugin.settings.compatibilityMode = value;
            filenameEl.innerHTML = getFilenameSample();
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("EXPORT_EXCALIDRAW_NAME"))
      .setDesc(fragWithHTML(t("EXPORT_EXCALIDRAW_DESC")))
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
      .setDesc(fragWithHTML(t("SYNC_EXCALIDRAW_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncExcalidraw)
          .onChange(async (value) => {
            this.plugin.settings.syncExcalidraw = value;
            this.applySettingsUpdate();
          }),
      );
  
    this.containerEl.createEl("h1", { text: t("NONSTANDARD_HEAD") });
    this.containerEl.createEl("p", { text: t("NONSTANDARD_DESC") });

    new Setting(containerEl)
      .setName(t("CUSTOM_PEN_NAME"))
      .setDesc(t("CUSTOM_PEN_DESC"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("0","0")
          .addOption("1","1")
          .addOption("2","2")
          .addOption("3","3")
          .addOption("4","4")
          .addOption("5","5")
          .addOption("6","6")
          .addOption("7","7")
          .addOption("8","8")
          .addOption("9","9")
          .addOption("10","10")
          .setValue(this.plugin.settings.numberOfCustomPens.toString())
          .onChange((value)=>{
            this.plugin.settings.numberOfCustomPens = parseInt(value);
            this.requestUpdatePinnedPens = true;
            this.applySettingsUpdate(false);
          })
      )

    new Setting(containerEl)
      .setName(t("ENABLE_FOURTH_FONT_NAME"))
      .setDesc(fragWithHTML(t("ENABLE_FOURTH_FONT_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.experimentalEnableFourthFont)
          .onChange(async (value) => {
            this.requestReloadDrawings = true;
            this.plugin.settings.experimentalEnableFourthFont = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("FOURTH_FONT_NAME"))
      .setDesc(fragWithHTML(t("FOURTH_FONT_DESC")))
      .addDropdown(async (d: DropdownComponent) => {
        d.addOption("Virgil", "Virgil");
        this.app.vault
          .getFiles()
          .filter((f) => ["ttf", "woff", "woff2"].contains(f.extension))
          .forEach((f: TFile) => {
            d.addOption(f.path, f.name);
          });
        d.setValue(this.plugin.settings.experimantalFourthFont).onChange(
          (value) => {
            this.requestReloadDrawings = true;
            this.plugin.settings.experimantalFourthFont = value;
            this.applySettingsUpdate(true);
            this.plugin.initializeFourthFont();
          },
        );
      });

    this.containerEl.createEl("h1", { text: t("EXPERIMENTAL_HEAD") });
    this.containerEl.createEl("p", { text: t("EXPERIMENTAL_DESC") });

    //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/628
    new Setting(containerEl)
      .setName(t("MATHJAX_NAME"))
      .setDesc(t("MATHJAX_DESC"))
      .addDropdown((dropdown) => {
        dropdown
          .addOption("https://cdn.jsdelivr.net/npm/mathjax@3.2.1/es5/tex-svg.js", "jsdelivr")
          .addOption("https://unpkg.com/mathjax@3.2.1/es5/tex-svg.js", "unpkg")
          .addOption("https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.1/es5/tex-svg-full.min.js","cdnjs")
          .setValue(this.plugin.settings.mathjaxSourceURL)
          .onChange((value)=> {
            this.plugin.settings.mathjaxSourceURL = value;
            this.reloadMathJax = true;
            this.applySettingsUpdate();
          })
      })

    new Setting(containerEl)
      .setName(t("LATEX_DEFAULT_NAME"))
      .setDesc(fragWithHTML(t("LATEX_DEFAULT_DESC")))
      .addText((text) =>
        text
          .setValue(this.plugin.settings.latexBoilerplate)
          .onChange( (value) => {
            this.plugin.settings.latexBoilerplate = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("FIELD_SUGGESTER_NAME"))
      .setDesc(fragWithHTML(t("FIELD_SUGGESTER_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.fieldSuggester)
          .onChange(async (value) => {
            this.plugin.settings.fieldSuggester = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("FILETYPE_NAME"))
      .setDesc(fragWithHTML(t("FILETYPE_DESC")))
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
      .setDesc(fragWithHTML(t("FILETAG_DESC")))
      .addText((text) =>
        text
          .setPlaceholder(t("INSERT_EMOJI"))
          .setValue(this.plugin.settings.experimentalFileTag)
          .onChange(async (value) => {
            this.plugin.settings.experimentalFileTag = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(containerEl)
      .setName(t("LIVEPREVIEW_NAME"))
      .setDesc(fragWithHTML(t("LIVEPREVIEW_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.experimentalLivePreview)
          .onChange(async (value) => {
            this.plugin.settings.experimentalLivePreview = value;
            this.applySettingsUpdate();
          }),
      );

    this.containerEl.createEl("h2", { text: t("TASKBONE_HEAD") });
    this.containerEl.createEl("p", { text: t("TASKBONE_DESC") });
    let taskboneAPIKeyText: TextComponent;

    new Setting(containerEl)
    .setName(t("TASKBONE_ENABLE_NAME"))
    .setDesc(fragWithHTML(t("TASKBONE_ENABLE_DESC")))
    .addToggle((toggle) =>
      toggle
        .setValue(this.plugin.settings.taskboneEnabled)
        .onChange(async (value) => {
          taskboneAPIKeyText.setDisabled(!value);
          this.plugin.settings.taskboneEnabled = value;
          if(this.plugin.settings.taskboneAPIkey === "") {
            const apiKey = await this.plugin.taskbone.initialize(false);
            if(apiKey) {
              taskboneAPIKeyText.setValue(apiKey);
            }
          }
          this.applySettingsUpdate();
        }),
    );

    new Setting(containerEl)
    .setName(t("TASKBONE_APIKEY_NAME"))
    .setDesc(fragWithHTML(t("TASKBONE_APIKEY_DESC")))
    .addText((text) => {
      taskboneAPIKeyText = text;
      taskboneAPIKeyText
        .setValue(this.plugin.settings.taskboneAPIkey)
        .onChange(async (value) => {
          this.plugin.settings.taskboneAPIkey = value;
          this.applySettingsUpdate();
        })
        .setDisabled(!this.plugin.settings.taskboneEnabled);
      }
    );

    //-------------------------------------
    //Script settings
    //-------------------------------------
    const scripts = this.plugin.scriptEngine
      .getListofScripts()
      ?.map((f) => this.plugin.scriptEngine.getScriptName(f));
    if (
      Object.keys(this.plugin.settings.scriptEngineSettings).length > 0 &&
      scripts
    ) {
      const textAreaHeight = (scriptName: string, variableName: string): any => {
        const variable =
          //@ts-ignore
          this.plugin.settings.scriptEngineSettings[scriptName][variableName];
        switch (typeof variable) {
          case "object":
            return variable.height;
          default:
            return null;
        }
      };

      const getValue = (scriptName: string, variableName: string): any => {
        const variable =
          //@ts-ignore
          this.plugin.settings.scriptEngineSettings[scriptName][variableName];
        switch (typeof variable) {
          case "object":
            return variable.value;
          default:
            return variable;
        }
      };

      const setValue = (
        scriptName: string,
        variableName: string,
        value: any,
      ) => {
        switch (
          //@ts-ignore
          typeof this.plugin.settings.scriptEngineSettings[scriptName][
            variableName
          ]
        ) {
          case "object":
            //@ts-ignore
            this.plugin.settings.scriptEngineSettings[scriptName][
              variableName
            ].value = value;
            break;
          default:
            //@ts-ignore
            this.plugin.settings.scriptEngineSettings[scriptName][
              variableName
            ] = value;
        }
      };

      const addBooleanSetting = (
        scriptName: string,
        variableName: string,
        description?: string,
      ) => {
        new Setting(containerEl)
          .setName(variableName)
          .setDesc(fragWithHTML(description ?? ""))
          .addToggle((toggle) =>
            toggle
              .setValue(getValue(scriptName, variableName))
              .onChange(async (value) => {
                setValue(scriptName, variableName, value);
                this.applySettingsUpdate();
              }),
          );
      };

      const addStringSetting = (
        scriptName: string,
        variableName: string,
        description?: string,
        valueset?: any,
      ) => {
        if (
          valueset &&
          Object.prototype.toString.call(valueset) === "[object Array]" &&
          valueset.length > 0
        ) {
          new Setting(containerEl)
            .setName(variableName)
            .setDesc(fragWithHTML(description ?? ""))
            .addDropdown((dropdown) => {
              valueset.forEach((val: any) =>
                dropdown.addOption(val.toString(), val.toString()),
              );
              dropdown
                .setValue(getValue(scriptName, variableName))
                .onChange(async (value) => {
                  setValue(scriptName, variableName, value);
                  this.applySettingsUpdate();
                });
            });
        } else {
          if(textAreaHeight(scriptName, variableName)) {
            new Setting(containerEl)
              .setName(variableName)
              .setDesc(fragWithHTML(description ?? ""))
              .addTextArea((text) => {
                text.inputEl.style.minHeight = textAreaHeight(scriptName, variableName);
                text.inputEl.style.minWidth = "400px";
                text
                  .setValue(getValue(scriptName, variableName))
                  .onChange(async (value) => {
                    setValue(scriptName, variableName, value);
                    this.applySettingsUpdate();
                  });
              });
          } else {
            new Setting(containerEl)
              .setName(variableName)
              .setDesc(fragWithHTML(description ?? ""))
              .addText((text) =>
                text
                  .setValue(getValue(scriptName, variableName))
                  .onChange(async (value) => {
                    setValue(scriptName, variableName, value);
                    this.applySettingsUpdate();
                  }),
              );
          }
        }
      };

      const addNumberSetting = (
        scriptName: string,
        variableName: string,
        description?: string,
      ) => {
        new Setting(containerEl)
          .setName(variableName)
          .setDesc(fragWithHTML(description ?? ""))
          .addText((text) =>
            text
              .setPlaceholder("Enter a number")
              .setValue(getValue(scriptName, variableName).toString())
              .onChange(async (value) => {
                const numVal = parseFloat(value);
                if (isNaN(numVal) && value !== "") {
                  text.setValue(getValue(scriptName, variableName).toString());
                  return;
                }
                setValue(scriptName, variableName, isNaN(numVal) ? 0 : numVal);
                this.applySettingsUpdate();
              }),
          );
      };

      this.containerEl.createEl("h1", { text: t("SCRIPT_SETTINGS_HEAD") });
      Object.keys(this.plugin.settings.scriptEngineSettings)
        .filter((s) => scripts.contains(s))
        .forEach((scriptName: string) => {
          const settings =
            //@ts-ignore
            this.plugin.settings.scriptEngineSettings[scriptName];
          const values = Object.values(settings);
          if (
            values.length === 0 ||
            (values.length > 0 &&
              values
                .map((val: any): number => (val.hidden ? 0 : 1))
                .reduce((prev, cur) => prev + cur) === 0)
          ) {
            return;
          }
          this.containerEl.createEl("h3", { text: scriptName });
          Object.keys(settings).forEach((variableName) => {
            const variable = settings[variableName];
            const item = variable.value ?? variable;
            switch (typeof item) {
              case "boolean":
                if (!variable.hidden) {
                  addBooleanSetting(
                    scriptName,
                    variableName,
                    variable.description,
                  );
                }
                break;
              case "string":
                if (!variable.hidden) {
                  addStringSetting(
                    scriptName,
                    variableName,
                    variable.description,
                    variable.valueset,
                  );
                }
                break;
              case "number":
                if (!variable.hidden) {
                  addNumberSetting(
                    scriptName,
                    variableName,
                    variable.description,
                  );
                }
                break;
            }
          });
        });
    }
  }
}
