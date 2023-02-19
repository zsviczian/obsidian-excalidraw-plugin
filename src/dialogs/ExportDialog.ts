import { ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/types";
import { Modal, Setting, SliderComponent, TFile } from "obsidian";
import { getEA } from "src";
import { DEVICE } from "src/Constants";
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
  private boundingBox: {
    topX: number;
    topY: number;
    width: number;
    height: number;
  };
  public embedScene: boolean;
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
    this.saveToVault = true;
    this.transparent = !getWithBackground(this.plugin, this.file);
    this.saveSettings = false;
  }

  onOpen(): void {
    this.containerEl.classList.add("excalidraw-release");
    this.titleEl.setText(`Export Image`);
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
  
    const themeMessage = () => `Export with ${this.theme} theme`;
    const themeSetting = new Setting(this.contentEl)
      .setName(themeMessage())
      .setDesc(fragWithHTML("<b>Toggle on:</b> Export with light theme<br><b>Toggle off:</b> Export with dark theme"))
      .addToggle(toggle =>
        toggle
          .setValue(this.theme === "dark" ? false : true)
          .onChange(value => {
            this.theme = value ? "light" : "dark";
            themeSetting.setName(themeMessage());
          })
        )

    const transparencyMessage = () => `Export with ${this.transparent ? "transparent ":""}background`;
    const transparentSetting = new Setting(this.contentEl)
      .setName(transparencyMessage())
      .setDesc(fragWithHTML("<b>Toggle on:</b> Export with transparent background<br><b>Toggle off:</b> Export with background"))
      .addToggle(toggle =>
        toggle
          .setValue(this.transparent)
          .onChange(value => {
            this.transparent = value;
            transparentSetting.setName(transparencyMessage())
          })
        )

    const saveSettingsMessage = () => this.saveSettings?"Save these settings as the preset for this image":"These are one-time settings"
    const saveSettingsSetting= new Setting(this.contentEl)
      .setName(saveSettingsMessage())
      .setDesc(fragWithHTML("Saving these settings as preset will override general export settings for this image.<br><b>Toggle on: </b>Save as preset for this image<br><b>Toggle off: </b>Don't save as preset"))
      .addToggle(toggle =>
        toggle
          .setValue(this.saveSettings)
          .onChange(value => {
            this.saveSettings = value;
            saveSettingsSetting.setName(saveSettingsMessage())
          })
        )

    this.contentEl.createEl("h1",{text:"Export settings"});

    const embedSceneMessage = () => this.embedScene?"Embed scene":"Do not embed scene";
    const embedSetting = new Setting(this.contentEl)
      .setName(embedSceneMessage())
      .setDesc(fragWithHTML("Embed the Excalidraw scene into the PNG or SVG image<br><b>Toggle on: </b>Embed scene<br><b>Toggle off: </b>Do not embed scene"))
      .addToggle(toggle =>
        toggle
          .setValue(this.embedScene)
          .onChange(value => {
            this.embedScene = value;
            embedSetting.setName(embedSceneMessage())
          })
        )

    if(DEVICE.isDesktop) {
      const saveToMessage = () => this.saveToVault?"Save image to your Vault":"Export image outside your Vault";
      const saveToSetting = new Setting(this.contentEl)
        .setName(saveToMessage())
        .setDesc(fragWithHTML("<b>Toggle on: </b>Save image to your Vault in the same folder as this drawing<br><b>Toggle off: </b>Save image outside your Vault"))
        .addToggle(toggle =>
          toggle
            .setValue(this.saveToVault)
            .onChange(value => {
              this.saveToVault = value;
              saveToSetting.setName(saveToMessage())
            })
          )
    }

    const div = this.contentEl.createDiv({cls: "excalidraw-prompt-buttons-div"});
    const bPNG = div.createEl("button", { text: "PNG to File", cls: "excalidraw-prompt-button"});
    bPNG.onclick = () => {
      this.saveToVault 
        ? this.view.savePNG()
        : this.view.exportPNG();
      this.close();
    };
    const bSVG = div.createEl("button", { text: "SVG to File", cls: "excalidraw-prompt-button" });
    bSVG.onclick = () => {
      this.saveToVault
        ? this.view.saveSVG()
        : this.view.exportSVG();
      this.close();
    };
    const bExcalidraw = div.createEl("button", { text: "Excalidraw", cls: "excalidraw-prompt-button" });
    bExcalidraw.onclick = () => {
      this.view.exportExcalidraw();
      this.close();
    };
    if(DEVICE.isDesktop) {
      const bPNGClipboard = div.createEl("button", { text: "PNG to Clipboard", cls: "excalidraw-prompt-button" });
      bPNGClipboard.onclick = () => {
        this.view.exportPNGToClipboard();
        this.close();
      };
    }
  }
}
