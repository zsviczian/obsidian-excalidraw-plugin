import { ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/excalidraw/types";
import { Modal, Setting, TFile } from "obsidian";
import { getEA } from "src/core";
import { DEVICE } from "src/constants/constants";
import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import ExcalidrawView from "src/view/ExcalidrawView";
import ExcalidrawPlugin from "src/core/main";
import { fragWithHTML, getExportPadding, getExportTheme, getPNGScale, getWithBackground, shouldEmbedScene } from "src/utils/utils";
import { PageOrientation, PageSize, STANDARD_PAGE_SIZES } from "src/utils/exportUtils";

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
  private buttonContainer: HTMLDivElement;

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
    this.saveSettings = false;
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
    this.titleEl.setText(`Export Image`);
    this.hasSelectedElements = this.view.getViewSelectedElements().length > 0;
    //@ts-ignore
    this.selectedOnlySetting.setVisibility(this.hasSelectedElements);
  }

  async onClose() {
    this.dirty = this.saveSettings;
  }

  async createForm() {
    if(DEVICE.isDesktop) {
      // Create tab container
      const tabContainer = this.contentEl.createDiv("nav-buttons-container");
      const imageTab = tabContainer.createEl("button", { 
        text: "Image",
        cls: `nav-button ${this.activeTab === "image" ? "is-active" : ""}`
      });

      
      const pdfTab = tabContainer.createEl("button", { 
        text: "PDF",
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
    this.buttonContainer = this.contentEl.createDiv({cls: "excalidraw-prompt-buttons-div"});

    this.renderContent();
  }

  private createSaveSettingsDropdown() {
    new Setting(this.contentContainer)
      .setName("Save settings?")
      .addDropdown(dropdown => 
        dropdown
          .addOption("save", "Save these settings as the preset for this image")
          .addOption("one-time", "These are one-time settings")
          .setValue(this.saveSettings ? "save" : "one-time")
          .onChange(value => {
            this.saveSettings = value === "save";
          })
      );
  }

  private renderContent() {
    this.contentContainer.empty();
    this.buttonContainer.empty();

    // Always show save settings dropdown
    this.createSaveSettingsDropdown();

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

    this.contentContainer.createEl("h1",{text: "Image settings"});
    this.contentContainer.createEl("p",{text: "Transparency only affects PNGs. Excalidraw files can only be exported outside the Vault. PNGs copied to clipboard may not include the scene."})

    const size = ():DocumentFragment => {
      const width = Math.round(this.scale*this.boundingBox.width + this.padding*2);
      const height = Math.round(this.scale*this.boundingBox.height + this.padding*2);
      return fragWithHTML(`The lager the scale, the larger the image.<br>Scale: <b>${this.scale}</b><br>Image size: <b>${width}x${height}</b>`);
    }

    const padding = ():DocumentFragment => {
      return fragWithHTML(`Current image padding is <b>${this.padding}</b>`);
    }

    paddingSetting = new Setting(this.contentContainer)
      .setName("Image padding")
      .setDesc(padding())
      .addSlider(slider => {
        slider
          .setLimits(0,50,1)
          .setValue(this.padding)
          .onChange(value => {
            this.padding = value;
            scaleSetting.setDesc(size());
            paddingSetting.setDesc(padding());
          })
        })
    
    scaleSetting = new Setting(this.contentContainer)
      .setName("Scale")
      .setDesc(size())
      .addSlider(slider => 
        slider
          .setLimits(0.5,5,0.5)
          .setValue(this.scale)
          .onChange(value => {
            this.scale = value;
            scaleSetting.setDesc(size());
          })
      )
  
    new Setting(this.contentContainer)
      .setName("Export theme")
      .addDropdown(dropdown => 
        dropdown
          .addOption("light","Light")
          .addOption("dark","Dark")
          .setValue(this.theme)
          .onChange(value => {
            this.theme = value;
          })
      )

    new Setting(this.contentContainer)
      .setName("Use scene background color")
      .addDropdown(dropdown => 
        dropdown
          .addOption("transparent","Transparent")
          .addOption("with-color","Use scene background color")
          .setValue(this.transparent?"transparent":"with-color")
          .onChange(value => {
            this.transparent = value === "transparent";
          })
      )

    this.selectedOnlySetting = new Setting(this.contentContainer)
      .setName("The scene or just selected elements?")
      .addDropdown(dropdown => 
        dropdown
          .addOption("all","Entire scene")
          .addOption("selected","Selected elements")
          .setValue(this.exportSelectedOnly?"selected":"all")
          .onChange(value => {
            this.exportSelectedOnly = value === "selected";
          })
      );
  }

  private createExportSettings() {
    this.contentContainer.createEl("h1",{text:"Export settings"});

    new Setting(this.contentContainer)
      .setName("Embed the Excalidraw scene in the exported file?")
      .addDropdown(dropdown => 
        dropdown
          .addOption("embed","Embed scene")
          .addOption("no-embed","Do not embed scene")
          .setValue(this.embedScene?"embed":"no-embed")
          .onChange(value => {
            this.embedScene = value === "embed";
          })
      )

    if(DEVICE.isDesktop) {
      new Setting(this.contentContainer)
      .setName("Where to save the image?")
      .addDropdown(dropdown => 
        dropdown
          .addOption("vault","Save image to your Vault")
          .addOption("outside","Export image outside your Vault")
          .setValue(this.saveToVault?"vault":"outside")
          .onChange(value => {
            this.saveToVault = value === "vault";
          })
      )
    }
  }

  private createPDFSettings() {
    if (!DEVICE.isDesktop) return;

    this.contentContainer.createEl("h1", { text: "PDF settings" });

    const pageSizeOptions: Record<string, string> = Object.keys(STANDARD_PAGE_SIZES)
      .reduce((acc, key) => ({
        ...acc,
        [key]: key
      }), {});

    new Setting(this.contentContainer)
      .setName("Page size")
      .addDropdown(dropdown => 
        dropdown
          .addOptions(pageSizeOptions)
          .setValue(this.pageSize)
          .onChange(value => {
            this.pageSize = value as PageSize;
          })
      );

    new Setting(this.contentContainer)
      .setName("Page orientation")
      .addDropdown(dropdown => 
        dropdown
          .addOptions({
            "portrait": "Portrait",
            "landscape": "Landscape"
          })
          .setValue(this.pageOrientation)
          .onChange(value => {
            this.pageOrientation = value as PageOrientation;
          })
      );
  }

  private createImageButtons() {
    const bPNG = this.buttonContainer.createEl("button", { text: "PNG > File", cls: "excalidraw-prompt-button"});
    bPNG.onclick = () => {
      this.saveToVault 
        ? this.view.savePNG(this.view.getScene(this.hasSelectedElements && this.exportSelectedOnly))
        : this.view.exportPNG(this.embedScene,this.hasSelectedElements && this.exportSelectedOnly);
      this.close();
    };
    const bSVG = this.buttonContainer.createEl("button", { text: "SVG > File", cls: "excalidraw-prompt-button" });
    bSVG.onclick = () => {
      this.saveToVault
        ? this.view.saveSVG(this.view.getScene(this.hasSelectedElements && this.exportSelectedOnly))
        : this.view.exportSVG(this.embedScene,this.hasSelectedElements && this.exportSelectedOnly);
      this.close();
    };
    const bExcalidraw = this.buttonContainer.createEl("button", { text: "Excalidraw", cls: "excalidraw-prompt-button" });
    bExcalidraw.onclick = () => {
      this.view.exportExcalidraw(this.hasSelectedElements && this.exportSelectedOnly);
      this.close();
    };
    if(DEVICE.isDesktop) {
      const bPNGClipboard = this.buttonContainer.createEl("button", { text: "PNG > Clipboard", cls: "excalidraw-prompt-button" });
      bPNGClipboard.onclick = () => {
        this.view.exportPNGToClipboard(this.embedScene, this.hasSelectedElements && this.exportSelectedOnly);
        this.close();
      };
    }
  }

  private createPDFButton() {
    if (!DEVICE.isDesktop) return;
    const bPDF = this.buttonContainer.createEl("button", { 
      text: "PDF", 
      cls: "excalidraw-prompt-button" 
    });
    bPDF.onclick = () => {
      this.view.exportPDF(
        this.hasSelectedElements && this.exportSelectedOnly,
        this.pageSize,
        this.pageOrientation
      );
      this.close();
    };
  }
}
