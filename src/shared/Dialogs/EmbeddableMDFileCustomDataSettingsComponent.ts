import { Setting, ToggleComponent } from "obsidian";
import { EmbeddableMDCustomProps } from "./EmbeddableSettings";
import { fragWithHTML } from "src/utils/utils";
import { t } from "src/lang/helpers";

export class EmbeddalbeMDFileCustomDataSettingsComponent {
  constructor (
    private contentEl: HTMLElement,
    private mdCustomData: EmbeddableMDCustomProps,
    private update?: Function,
    private isMDFile: boolean = true,
  ) { 
    if(!update) this.update = () => {};
  }

  render() {
    let detailsDIV: HTMLDivElement;

    new Setting(this.contentEl)
      .setName(t("ES_USE_OBSIDIAN_DEFAULTS"))
      .addToggle(toggle => 
        toggle
          .setValue(this.mdCustomData.useObsidianDefaults)
          .onChange(value => {
            this.mdCustomData.useObsidianDefaults = value;
            detailsDIV.style.display = value ? "none" : "block";
            this.update();
          })
      );
    
    this.contentEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    
    detailsDIV = this.contentEl.createDiv();
    detailsDIV.style.display = this.mdCustomData.useObsidianDefaults ? "none" : "block";

    const contentEl = detailsDIV
    if(this.isMDFile) {
      new Setting(contentEl)
          .setName(t("ES_FILENAME_VISIBLE"))
          .addToggle(toggle => 
            toggle
              .setValue(this.mdCustomData.filenameVisible)
              .onChange(value => {
                this.mdCustomData.filenameVisible = value;
              })
          );
      }
      contentEl.createEl("h4",{text: t("ES_BACKGROUND_HEAD")});
      const descDiv = contentEl.createDiv({ cls: "excalidraw-setting-desc" });
      descDiv.textContent = t("ES_BACKGROUND_DESC_INFO");

      descDiv.addEventListener("click", () => {
        if (descDiv.textContent === t("ES_BACKGROUND_DESC_INFO")) {
          descDiv.textContent = t("ES_BACKGROUND_DESC_DETAIL");
        } else {
          descDiv.textContent = t("ES_BACKGROUND_DESC_INFO");
        }
      });
      
      let bgSetting: Setting;  
      let bgMatchElementToggle: ToggleComponent;
      let bgMatchCanvasToggle: ToggleComponent;
      new Setting(contentEl)
        .setName(t("ES_BACKGROUND_MATCH_ELEMENT"))
        .addToggle(toggle => {
          bgMatchElementToggle = toggle;
          toggle
            .setValue(this.mdCustomData.backgroundMatchElement)
            .onChange(value => {
              this.mdCustomData.backgroundMatchElement = value;
              if(value) {
                bgSetting.settingEl.style.display = "none";
                if(this.mdCustomData.backgroundMatchCanvas) {
                  bgMatchCanvasToggle.setValue(false);
                }
              } else {
                if(!this.mdCustomData.backgroundMatchCanvas) {
                  bgSetting.settingEl.style.display = "";
                }
              }
              this.update();
            })
          });

      new Setting(contentEl)
        .setName(t("ES_BACKGROUND_MATCH_CANVAS"))
        .addToggle(toggle => {
          bgMatchCanvasToggle = toggle;
          toggle
            .setValue(this.mdCustomData.backgroundMatchCanvas)
            .onChange(value => {
              this.mdCustomData.backgroundMatchCanvas = value;
              if(value) {
                bgSetting.settingEl.style.display = "none";
                if(this.mdCustomData.backgroundMatchElement) {
                  bgMatchElementToggle.setValue(false);
                }
              } else {
                if(!this.mdCustomData.backgroundMatchElement) {
                    bgSetting.settingEl.style.display = "";
                }
              }
              this.update();
            })
          });

      if(this.mdCustomData.backgroundMatchElement && this.mdCustomData.backgroundMatchCanvas) {
        bgMatchCanvasToggle.setValue(false);
      }

      bgSetting = new Setting(contentEl)
        .setName(t("ES_BACKGROUND_COLOR"))
        .addColorPicker(colorPicker =>
          colorPicker
            .setValue(this.mdCustomData.backgroundColor)
            .onChange((value) => {
              this.mdCustomData.backgroundColor = value;
              this.update();
            })
        );
      
      bgSetting.settingEl.style.display = (this.mdCustomData.backgroundMatchElement || this.mdCustomData.backgroundMatchCanvas) ? "none" : "";
      const opacity = (value:number):DocumentFragment => {
        return fragWithHTML(`Current opacity is <b>${value}%</b>`);
      }

      const bgOpacitySetting = new Setting(contentEl)
        .setName(t("ES_BACKGROUND_OPACITY"))
        .setDesc(opacity(this.mdCustomData.backgroundOpacity))
        .addSlider(slider => 
          slider
            .setLimits(0,100,5)
            .setValue(this.mdCustomData.backgroundOpacity)
            .onChange(value => {
              this.mdCustomData.backgroundOpacity = value;
              bgOpacitySetting.setDesc(opacity(value));
              this.update();
            })
        );
      
      if(this.isMDFile) {
        contentEl.createEl("h4",{text: t("ES_BORDER_HEAD")});
        let borderSetting: Setting;

        new Setting(contentEl)
          .setName(t("ES_BORDER_MATCH_ELEMENT"))
          .addToggle(toggle => 
            toggle
              .setValue(this.mdCustomData.borderMatchElement)
              .onChange(value => {
                this.mdCustomData.borderMatchElement = value;
                if(value) {
                  borderSetting.settingEl.style.display = "none";
                } else {
                  borderSetting.settingEl.style.display = "";
                }
                this.update();
              })
          );

        borderSetting = new Setting(contentEl)
          .setName(t("ES_BORDER_COLOR"))
          .addColorPicker(colorPicker =>
            colorPicker
              .setValue(this.mdCustomData.borderColor)
              .onChange((value) => {
                this.mdCustomData.borderColor = value;
                this.update();
              })
          );

        borderSetting.settingEl.style.display = this.mdCustomData.borderMatchElement ? "none" : "";

        const borderOpacitySetting = new Setting(contentEl)
          .setName(t("ES_BORDER_OPACITY"))
          .setDesc(opacity(this.mdCustomData.borderOpacity))
          .addSlider(slider => 
            slider
              .setLimits(0,100,5)
              .setValue(this.mdCustomData.borderOpacity)
              .onChange(value => {
                this.mdCustomData.borderOpacity = value;
                borderOpacitySetting.setDesc(opacity(value));
                this.update();
          })
        );
      }
  }
} 