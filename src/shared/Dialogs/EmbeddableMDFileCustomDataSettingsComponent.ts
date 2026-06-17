import { Setting, ToggleComponent } from "obsidian";
import { EmbeddableMDCustomProps } from "./EmbeddableSettings";
import { fragWithHTML } from "src/utils/utils";
import { t } from "src/lang/helpers";
import { hideElement, showElement } from "src/utils/styleUtils";

export class EmbeddalbeMDFileCustomDataSettingsComponent {
  constructor(
    private contentEl: HTMLElement,
    private mdCustomData: EmbeddableMDCustomProps,
    private update?: () => void,
    private isMDFile: boolean = true,
  ) {
    if (!update) {
      this.update = () => {};
    }
  }

  render() {
    new Setting(this.contentEl)
      .setName(t("ES_USE_OBSIDIAN_DEFAULTS"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.mdCustomData.useObsidianDefaults)
          .onChange((value) => {
            this.mdCustomData.useObsidianDefaults = value;
            if (value) {
              hideElement(detailsDIV);
            } else {
              showElement(detailsDIV);
            }
            this.update();
          }),
      );

    this.contentEl.createEl("hr", { cls: "excalidraw-setting-hr" });

    const detailsDIV = this.contentEl.createDiv();
    if (this.mdCustomData.useObsidianDefaults) {
      hideElement(detailsDIV);
    } else {
      showElement(detailsDIV);
    }

    const contentEl = detailsDIV;
    if (this.isMDFile) {
      new Setting(contentEl)
        .setName(t("ES_FILENAME_VISIBLE"))
        .addToggle((toggle) =>
          toggle
            .setValue(this.mdCustomData.filenameVisible)
            .onChange((value) => {
              this.mdCustomData.filenameVisible = value;
            }),
        );

      new Setting(contentEl)
        .setName(t("ES_LOCKED_READING_MODE_HEAD"))
        .setDesc(t("ES_LOCKED_READING_MODE_DESC"))
        .addToggle((toggle) =>
          toggle
            .setValue(!!this.mdCustomData.lockedReadingMode)
            .onChange((value) => {
              this.mdCustomData.lockedReadingMode = value;
            }),
        );
    }

    contentEl.createEl("h4", { text: t("ES_BACKGROUND_HEAD") });
    const descDiv = contentEl.createDiv({ cls: "excalidraw-setting-desc" });
    descDiv.textContent = t("ES_BACKGROUND_DESC_INFO");

    descDiv.addEventListener("click", () => {
      if (descDiv.textContent === t("ES_BACKGROUND_DESC_INFO")) {
        descDiv.textContent = t("ES_BACKGROUND_DESC_DETAIL");
      } else {
        descDiv.textContent = t("ES_BACKGROUND_DESC_INFO");
      }
    });

    let bgMatchElementToggle: ToggleComponent;
    let bgMatchCanvasToggle: ToggleComponent;
    new Setting(contentEl)
      .setName(t("ES_BACKGROUND_MATCH_ELEMENT"))
      .addToggle((toggle) => {
        bgMatchElementToggle = toggle;
        toggle
          .setValue(this.mdCustomData.backgroundMatchElement)
          .onChange((value) => {
            this.mdCustomData.backgroundMatchElement = value;
            if (value) {
              hideElement(bgSetting.settingEl);
              if (this.mdCustomData.backgroundMatchCanvas) {
                bgMatchCanvasToggle.setValue(false);
              }
            } else if (!this.mdCustomData.backgroundMatchCanvas) {
              showElement(bgSetting.settingEl);
            }
            this.update();
          });
      });

    new Setting(contentEl)
      .setName(t("ES_BACKGROUND_MATCH_CANVAS"))
      .addToggle((toggle) => {
        bgMatchCanvasToggle = toggle;
        toggle
          .setValue(this.mdCustomData.backgroundMatchCanvas)
          .onChange((value) => {
            this.mdCustomData.backgroundMatchCanvas = value;
            if (value) {
              hideElement(bgSetting.settingEl);
              if (this.mdCustomData.backgroundMatchElement) {
                bgMatchElementToggle.setValue(false);
              }
            } else if (!this.mdCustomData.backgroundMatchElement) {
              showElement(bgSetting.settingEl);
            }
            this.update();
          });
      });

    if (
      this.mdCustomData.backgroundMatchElement &&
      this.mdCustomData.backgroundMatchCanvas
    ) {
      bgMatchCanvasToggle.setValue(false);
    }

    const bgSetting = new Setting(contentEl)
      .setName(t("ES_BACKGROUND_COLOR"))
      .addColorPicker((colorPicker) =>
        colorPicker
          .setValue(this.mdCustomData.backgroundColor)
          .onChange((value) => {
            this.mdCustomData.backgroundColor = value;
            this.update();
          }),
      );

    if (
      this.mdCustomData.backgroundMatchElement ||
      this.mdCustomData.backgroundMatchCanvas
    ) {
      hideElement(bgSetting.settingEl);
    } else {
      showElement(bgSetting.settingEl);
    }
    const opacity = (value: number): DocumentFragment => {
      return fragWithHTML(`Current opacity is <b>${value}%</b>`);
    };

    const bgOpacitySetting = new Setting(contentEl)
      .setName(t("ES_BACKGROUND_OPACITY"))
      .setDesc(opacity(this.mdCustomData.backgroundOpacity))
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 5)
          .setValue(this.mdCustomData.backgroundOpacity)
          .onChange((value) => {
            this.mdCustomData.backgroundOpacity = value;
            bgOpacitySetting.setDesc(opacity(value));
            this.update();
          }),
      );

    if (this.isMDFile) {
      contentEl.createEl("h4", { text: t("ES_BORDER_HEAD") });

      new Setting(contentEl)
        .setName(t("ES_BORDER_MATCH_ELEMENT"))
        .addToggle((toggle) =>
          toggle
            .setValue(this.mdCustomData.borderMatchElement)
            .onChange((value) => {
              this.mdCustomData.borderMatchElement = value;
              if (value) {
                hideElement(borderSetting.settingEl);
              } else {
                showElement(borderSetting.settingEl);
              }
              this.update();
            }),
        );

      const borderSetting = new Setting(contentEl)
        .setName(t("ES_BORDER_COLOR"))
        .addColorPicker((colorPicker) =>
          colorPicker
            .setValue(this.mdCustomData.borderColor)
            .onChange((value) => {
              this.mdCustomData.borderColor = value;
              this.update();
            }),
        );

      if (this.mdCustomData?.borderMatchElement) {
        hideElement(borderSetting.settingEl);
      } else {
        showElement(borderSetting.settingEl);
      }

      const borderOpacitySetting = new Setting(contentEl)
        .setName(t("ES_BORDER_OPACITY"))
        .setDesc(opacity(this.mdCustomData.borderOpacity))
        .addSlider((slider) =>
          slider
            .setLimits(0, 100, 5)
            .setValue(this.mdCustomData.borderOpacity)
            .onChange((value) => {
              this.mdCustomData.borderOpacity = value;
              borderOpacitySetting.setDesc(opacity(value));
              this.update();
            }),
        );
    }
  }
}
