import { ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/types";
import { Modal, Setting, TFile } from "obsidian";
import { getEA } from "src";
import { DEVICE } from "src/constants";
import { ExcalidrawAutomate } from "src/ExcalidrawAutomate";
import ExcalidrawView from "src/ExcalidrawView";
import ExcalidrawPlugin from "src/main";
import { fragWithHTML, getExportPadding, getExportTheme, getPNGScale, getWithBackground } from "src/utils/Utils";

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

  constructor(
    private plugin: ExcalidrawPlugin,
    private view: ExcalidrawView,
    private file: TFile,
  ) {
    super(app);
    this.ea = getEA(this.view);
    this.api = this.ea.getExcalidrawAPI() as ExcalidrawImperativeAPI;
    this.padding = getExportPadding(this.plugin,this.file);
    this.scale = getPNGScale(this.plugin,this.file)
    this.theme = getExportTheme(this.plugin, this.file, (this.api).getAppState().theme)
    this.boundingBox = this.ea.getBoundingBox(this.ea.getViewElements());
    this.embedScene = false;
    this.exportSelectedOnly = false;
    this.saveToVault = true;
    this.transparent = !getWithBackground(this.plugin, this.file);
    this.saveSettings = false;
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
    let scaleSetting:Setting;
    let paddingSetting: Setting;

    this.contentEl.createEl("h1",{text: "Image settings"});
    this.contentEl.createEl("p",{text: "Transparency only affects PNGs. Excalidraw files can only be exported outside the Vault. PNGs copied to clipboard may not include the scene."})

    const size = ():DocumentFragment => {
      const width = Math.round(this.scale*this.boundingBox.width + this.padding*2);
      const height = Math.round(this.scale*this.boundingBox.height + this.padding*2);
      return fragWithHTML(`The lager the scale, the larger the image.<br>Scale: <b>${this.scale}</b><br>Image size: <b>${width}x${height}</b>`);
    }

    const padding = ():DocumentFragment => {
      return fragWithHTML(`Current image padding is <b>${this.padding}</b>`);
    }

    paddingSetting = new Setting(this.contentEl)
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
    
    scaleSetting = new Setting(this.contentEl)
      .setName("PNG Scale")
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
  
    new Setting(this.contentEl)
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

    new Setting(this.contentEl)
      .setName("Background color")
      .addDropdown(dropdown => 
        dropdown
          .addOption("transparent","Transparent")
          .addOption("with-color","Use scene background color")
          .setValue(this.transparent?"transparent":"with-color")
          .onChange(value => {
            this.transparent = value === "transparent";
          })
      )
    
    new Setting(this.contentEl)
      .setName("Save or one-time settings?")
      .addDropdown(dropdown => 
        dropdown
          .addOption("save","Save these settings as the preset for this image")
          .addOption("one-time","These are one-time settings")
          .setValue(this.saveSettings?"save":"one-time")
          .onChange(value => {
            this.saveSettings = value === "save";
          })
      )

    this.contentEl.createEl("h1",{text:"Export settings"});

    new Setting(this.contentEl)
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
      new Setting(this.contentEl)
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

    this.selectedOnlySetting = new Setting(this.contentEl)
      .setName("Export entire scene or just selected elements?")
      .addDropdown(dropdown => 
        dropdown
          .addOption("all","Export entire scene")
          .addOption("selected","Export selected elements")
          .setValue(this.exportSelectedOnly?"selected":"all")
          .onChange(value => {
            this.exportSelectedOnly = value === "selected";
          })
      )


    const div = this.contentEl.createDiv({cls: "excalidraw-prompt-buttons-div"});
    const bPNG = div.createEl("button", { text: "PNG to File", cls: "excalidraw-prompt-button"});
    bPNG.onclick = () => {
      this.saveToVault 
        ? this.view.savePNG(this.view.getScene(this.hasSelectedElements && this.exportSelectedOnly))
        : this.view.exportPNG(this.embedScene,this.hasSelectedElements && this.exportSelectedOnly);
      this.close();
    };
    const bSVG = div.createEl("button", { text: "SVG to File", cls: "excalidraw-prompt-button" });
    bSVG.onclick = () => {
      this.saveToVault
        ? this.view.saveSVG(this.view.getScene(this.hasSelectedElements && this.exportSelectedOnly))
        : this.view.exportSVG(this.embedScene,this.hasSelectedElements && this.exportSelectedOnly);
      this.close();
    };
    const bExcalidraw = div.createEl("button", { text: "Excalidraw", cls: "excalidraw-prompt-button" });
    bExcalidraw.onclick = () => {
      this.view.exportExcalidraw(this.hasSelectedElements && this.exportSelectedOnly);
      this.close();
    };
    if(DEVICE.isDesktop) {
      const bPNGClipboard = div.createEl("button", { text: "PNG to Clipboard", cls: "excalidraw-prompt-button" });
      bPNGClipboard.onclick = () => {
        this.view.exportPNGToClipboard(this.embedScene, this.hasSelectedElements && this.exportSelectedOnly);
        this.close();
      };
    }
  }
}
