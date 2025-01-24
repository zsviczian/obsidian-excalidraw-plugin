import { ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/excalidraw/types";
import { Modal, Notice, Setting, TFile, ButtonComponent } from "obsidian";
import { getEA } from "src/core";
import { DEVICE } from "src/constants/constants";
import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import ExcalidrawView from "src/view/ExcalidrawView";
import ExcalidrawPlugin from "src/core/main";
import { fragWithHTML, getExportPadding, getExportTheme, getPNGScale, getWithBackground, shouldEmbedScene } from "src/utils/utils";
import { PageOrientation, PageSize, PDFPageAlignment, PDFPageMarginString, exportSVGToClipboard } from "src/utils/exportUtils";
import { t } from "src/lang/helpers";
import { PDFExportSettings, PDFExportSettingsComponent } from "./PDFExportSettingsComponent";



export class ExportDialog extends Modal {
  private ea: ExcalidrawAutomate;
  private api: ExcalidrawImperativeAPI;
  public padding: number;
  public scale: number;
  public theme: string;
  public transparent: boolean;
  public saveSettings: boolean;
  public dirty: boolean = false;
  private selectedOnlySetting: Setting;
  private hasSelectedElements: boolean = false;
  private boundingBox: {
    topX: number;
    topY: number;
    width: number;
    height: number;
  };
  public embedScene: boolean;
  public exportSelectedOnly: boolean;
  public saveToVault: boolean;
  public pageSize: PageSize = "A4";
  public pageOrientation: PageOrientation = "portrait";
  private activeTab: "image" | "pdf" = "image";
  private contentContainer: HTMLDivElement;
  private buttonContainerRow1: HTMLDivElement;
  private buttonContainerRow2: HTMLDivElement;
  public fitToPage: number = 1;
  public paperColor: "white" | "scene" | "custom" = "white";
  public customPaperColor: string = "#ffffff";
  public alignment: PDFPageAlignment = "center";
  public margin: PDFPageMarginString = "normal";

  constructor(
    private plugin: ExcalidrawPlugin,
    private view: ExcalidrawView,
    private file: TFile,
  ) {
    super(plugin.app);
    this.ea = getEA(this.view);
    this.api = this.ea.getExcalidrawAPI() as ExcalidrawImperativeAPI;
    this.padding = getExportPadding(this.plugin,this.file);
    this.scale = getPNGScale(this.plugin,this.file)
    this.theme = getExportTheme(this.plugin, this.file, (this.api).getAppState().theme)
    this.boundingBox = this.ea.getBoundingBox(this.ea.getViewElements());
    this.embedScene = shouldEmbedScene(this.plugin, this.file);
    this.exportSelectedOnly = false;
    this.saveToVault = true;
    this.transparent = !getWithBackground(this.plugin, this.file);

    this.pageSize = plugin.settings.pdfSettings.pageSize;
    this.pageOrientation = plugin.settings.pdfSettings.pageOrientation;
    this.fitToPage = plugin.settings.pdfSettings.fitToPage;
    this.paperColor = plugin.settings.pdfSettings.paperColor;
    this.customPaperColor = plugin.settings.pdfSettings.customPaperColor;
    this.alignment = plugin.settings.pdfSettings.alignment;
    this.margin = plugin.settings.pdfSettings.margin;

    this.saveSettings = false;
    this.createForm();
  }

  destroy() {
    this.app = null;
    this.plugin = null;
    this.ea.destroy();
    this.ea = null;
    this.view = null;
    this.file = null;
    this.api = null;
    this.theme = null;
    this.selectedOnlySetting = null;
    this.containerEl.remove();
  }

  onOpen(): void {
    this.containerEl.classList.add("excalidraw-release");
    this.titleEl.setText(t("EXPORTDIALOG_TITLE"));
    this.hasSelectedElements = this.view.getViewSelectedElements().length > 0;
    //@ts-ignore
    this.selectedOnlySetting.setVisibility(this.hasSelectedElements);
  }

  async onClose() {
    this.dirty = this.saveSettings;
  }

  createForm() {
    if(DEVICE.isDesktop) {
      // Create tab container
      const tabContainer = this.contentEl.createDiv("nav-buttons-container");
      const imageTab = tabContainer.createEl("button", { 
        text: t("EXPORTDIALOG_TAB_IMAGE"),
        cls: `nav-button ${this.activeTab === "image" ? "is-active" : ""}`
      });

      
      const pdfTab = tabContainer.createEl("button", { 
        text: t("EXPORTDIALOG_TAB_PDF"),
        cls: `nav-button ${this.activeTab === "pdf" ? "is-active" : ""}`
      });

      // Tab click handlers
      imageTab.onclick = () => {
        this.activeTab = "image";
        imageTab.addClass("is-active");
        pdfTab.removeClass("is-active");
        this.renderContent();
      };

      pdfTab.onclick = () => {
        this.activeTab = "pdf";
        pdfTab.addClass("is-active");
        imageTab.removeClass("is-active");
        this.renderContent();
      };
    }

    // Create content container
    this.contentContainer = this.contentEl.createDiv();
    this.buttonContainerRow1 = this.contentEl.createDiv({cls: "excalidraw-export-buttons-div"});
    this.buttonContainerRow2 = this.contentEl.createDiv({cls: "excalidraw-export-buttons-div"});
    this.buttonContainerRow2.style.marginTop = "10px";

    this.renderContent();
  }

  private createSaveSettingsDropdown() {
    new Setting(this.contentContainer)
      .setName(t("EXPORTDIALOG_SAVE_SETTINGS"))
      .addDropdown(dropdown => 
        dropdown
          .addOption("save", t("EXPORTDIALOG_SAVE_SETTINGS_SAVE"))
          .addOption("one-time", t("EXPORTDIALOG_SAVE_SETTINGS_ONETIME"))
          .setValue(this.saveSettings ? "save" : "one-time")
          .onChange(value => {
            this.saveSettings = value === "save";
          })
      );
  }

  private renderContent() {
    this.contentContainer.empty();
    this.buttonContainerRow1.empty();
    this.buttonContainerRow2.empty();

    if (this.activeTab === "image") {
      this.createImageSettings();
      this.createExportSettings();
      this.createImageButtons();
    } else {
      this.createImageSettings();
      this.createPDFSettings();
      this.createPDFButton();
    }
  }
  
  private createImageSettings() {
    let scaleSetting:Setting;
    let paddingSetting: Setting;   

    this.contentContainer.createEl("h1",{text: t("EXPORTDIALOG_IMAGE_SETTINGS")});
    this.contentContainer.createEl("p",{text: t("EXPORTDIALOG_IMAGE_DESC")})

    this.createSaveSettingsDropdown();

    const size = ():DocumentFragment => {
      const width = Math.round(this.scale*this.boundingBox.width + this.padding*2);
      const height = Math.round(this.scale*this.boundingBox.height + this.padding*2);
      return fragWithHTML(`${t("EXPORTDIALOG_SIZE_DESC")}<br>${t("EXPORTDIALOG_SCALE_VALUE")} <b>${this.scale}</b><br>${t("EXPORTDIALOG_IMAGE_SIZE")} <b>${width}x${height}</b>`);
    }

    const padding = ():DocumentFragment => {
      return fragWithHTML(`${t("EXPORTDIALOG_CURRENT_PADDING")} <b>${this.padding}</b>`);
    }

    paddingSetting = new Setting(this.contentContainer)
      .setName(t("EXPORTDIALOG_PADDING"))
      .setDesc(padding())
      .addSlider(slider => {
        slider
          .setLimits(0,100,1)
          .setValue(this.padding)
          .onChange(value => {
            this.padding = value;
            scaleSetting.setDesc(size());
            paddingSetting.setDesc(padding());
          })
        })
    
    scaleSetting = new Setting(this.contentContainer)
      .setName(t("EXPORTDIALOG_SCALE"))
      .setDesc(size())
      .addSlider(slider => 
        slider
          .setLimits(0.2,7,0.1)
          .setValue(this.scale)
          .onChange(value => {
            this.scale = value;
            scaleSetting.setDesc(size());
          })
      )
  
    new Setting(this.contentContainer)
      .setName(t("EXPORTDIALOG_EXPORT_THEME"))
      .addDropdown(dropdown => 
        dropdown
          .addOption("light", t("EXPORTDIALOG_THEME_LIGHT"))
          .addOption("dark", t("EXPORTDIALOG_THEME_DARK"))
          .setValue(this.theme)
          .onChange(value => {
            this.theme = value;
          })
      )

    new Setting(this.contentContainer)
      .setName(t("EXPORTDIALOG_BACKGROUND"))
      .addDropdown(dropdown => 
        dropdown
          .addOption("transparent", t("EXPORTDIALOG_BACKGROUND_TRANSPARENT"))
          .addOption("with-color", t("EXPORTDIALOG_BACKGROUND_USE_COLOR"))
          .setValue(this.transparent?"transparent":"with-color")
          .onChange(value => {
            this.transparent = value === "transparent";
          })
      )

    this.selectedOnlySetting = new Setting(this.contentContainer)
      .setName(t("EXPORTDIALOG_SELECTED_ELEMENTS"))
      .addDropdown(dropdown => 
        dropdown
          .addOption("all", t("EXPORTDIALOG_SELECTED_ALL"))
          .addOption("selected", t("EXPORTDIALOG_SELECTED_SELECTED"))
          .setValue(this.exportSelectedOnly?"selected":"all")
          .onChange(value => {
            this.exportSelectedOnly = value === "selected";
          })
      );
  }

  private createExportSettings() {
    new Setting(this.contentContainer)
      .setName(t("EXPORTDIALOG_EMBED_SCENE"))
      .addDropdown(dropdown => 
        dropdown
          .addOption("embed",t("EXPORTDIALOG_EMBED_YES"))
          .addOption("no-embed",t("EXPORTDIALOG_EMBED_NO"))
          .setValue(this.embedScene?"embed":"no-embed")
          .onChange(value => {
            this.embedScene = value === "embed";
          })
      )
  }

  private createPDFSettings() {
    if (!DEVICE.isDesktop) return;

    this.contentContainer.createEl("h1", { text: t("EXPORTDIALOG_PDF_SETTINGS") });

    const pdfSettings: PDFExportSettings = {
      pageSize: this.pageSize,
      pageOrientation: this.pageOrientation,
      fitToPage: this.fitToPage,
      paperColor: this.paperColor,
      customPaperColor: this.customPaperColor,
      alignment: this.alignment,
      margin: this.margin,
    };

    new PDFExportSettingsComponent(
      this.contentContainer,
      pdfSettings,
      () => {
        this.pageSize = pdfSettings.pageSize;
        this.pageOrientation = pdfSettings.pageOrientation;
        this.fitToPage = pdfSettings.fitToPage;
        this.paperColor = pdfSettings.paperColor;
        this.customPaperColor = pdfSettings.customPaperColor;
        this.alignment = pdfSettings.alignment;
        this.margin = pdfSettings.margin;
      }
    ).render();
  }

  private createImageButtons() {
    if(DEVICE.isDesktop) {
      const bPNG = this.buttonContainerRow1.createEl("button", { 
        text: t("EXPORTDIALOG_PNGTOFILE"), 
        cls: "excalidraw-export-button"
      });
      bPNG.onclick = () => {
        this.view.exportPNG(this.embedScene, this.hasSelectedElements && this.exportSelectedOnly);
        this.close();
      };
    }

    const bPNGVault = this.buttonContainerRow1.createEl("button", { 
      text: t("EXPORTDIALOG_PNGTOVAULT"), 
      cls: "excalidraw-export-button"
    });
    bPNGVault.onclick = () => {
      this.view.savePNG(this.view.getScene(this.hasSelectedElements && this.exportSelectedOnly));
      this.close();
    };

    const bPNGClipboard = this.buttonContainerRow1.createEl("button", { 
      text: t("EXPORTDIALOG_PNGTOCLIPBOARD"), 
      cls: "excalidraw-export-button"
    });
    bPNGClipboard.onclick = async () => {
      this.view.exportPNGToClipboard(this.embedScene, this.hasSelectedElements && this.exportSelectedOnly);
      this.close();
    };

    if(DEVICE.isDesktop) {
      const bExcalidraw = this.buttonContainerRow2.createEl("button", { 
        text: t("EXPORTDIALOG_EXCALIDRAW"), 
        cls: "excalidraw-export-button" 
      });
      bExcalidraw.onclick = () => {
        this.view.exportExcalidraw();
        this.close();
      };

      const bSVG = this.buttonContainerRow2.createEl("button", { 
        text: t("EXPORTDIALOG_SVGTOFILE"), 
        cls: "excalidraw-export-button" 
      });
      bSVG.onclick = () => {
        this.view.exportSVG(this.embedScene, this.hasSelectedElements && this.exportSelectedOnly);
        this.close();
      };
    }

    const bSVGVault = this.buttonContainerRow2.createEl("button", { 
      text: t("EXPORTDIALOG_SVGTOVAULT"), 
      cls: "excalidraw-export-button" 
    });
    bSVGVault.onclick = () => {
      this.view.saveSVG(this.view.getScene(this.hasSelectedElements && this.exportSelectedOnly));
      this.close();
    };

    const bSVGClipboard = this.buttonContainerRow2.createEl("button", { 
      text: t("EXPORTDIALOG_SVGTOCLIPBOARD"), 
      cls: "excalidraw-export-button" 
    });
    bSVGClipboard.onclick = async () => {
      const svg = await this.view.getSVG(this.embedScene, this.hasSelectedElements && this.exportSelectedOnly);
      exportSVGToClipboard(svg);
      this.close();
    };
  }

  private createPDFButton() {
    const bSavePDFSettings = this.buttonContainerRow1.createEl("button",
      { text: t("EXPORTDIALOG_SAVE_PDF_SETTINGS"), cls: "excalidraw-export-button" }
    );
    bSavePDFSettings.onclick = async () => {
      //in case sync loaded a new version of settings in the mean time
      await this.plugin.loadSettings();
      this.plugin.settings.pdfSettings = {
        pageSize: this.pageSize,
        pageOrientation: this.pageOrientation,
        fitToPage: this.fitToPage,
        paperColor: this.paperColor,
        customPaperColor: this.customPaperColor,
        alignment: this.alignment,
        margin: this.margin,
      };
      await this.plugin.saveSettings();
      new Notice(t("EXPORTDIALOG_SAVE_CONFIRMATION"));
    };

    if (!DEVICE.isDesktop) return;
    const bPDFExport = this.buttonContainerRow1.createEl("button", { 
      text: t("EXPORTDIALOG_PDF"), 
      cls: "excalidraw-export-button" 
    });
    bPDFExport.onclick = () => {
      this.view.exportPDF(
        this.hasSelectedElements && this.exportSelectedOnly,
        this.pageSize,
        this.pageOrientation
      );
      this.close();
    };
  }

  public getPaperColor(): string {
    switch (this.paperColor) {
      case "white": return this.theme === "light" ? "#ffffff" : "#000000";
      case "scene": return this.api.getAppState().viewBackgroundColor;
      case "custom": return this.customPaperColor;
      default: return "#ffffff";
    }
  }
}
