import ExcalidrawPlugin from "src/core/main";
import { t } from "src/lang/helpers";
import { UIModeSettingsComponent } from "./UIModeSettingComponent";
import { Modal } from "obsidian";

export class UIModeSettings extends Modal {
  private isDirty = false;
  constructor(
    private plugin: ExcalidrawPlugin,
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    this.containerEl.classList.add("excalidraw-release");
    this.createForm();
  }

  async onClose() {
    if (this.isDirty) {
      await this.plugin.saveSettings();
    }
    this.plugin = null;
  }

  async createForm() {
    this.contentEl.createEl("h1",{text: t("MODES_HEAD")});
    new UIModeSettingsComponent(
      this.contentEl,
      this.plugin.settings,
      this.app,
      ()=>this.applySettingsUpdate(),
      ()=>this.close(),
    ).render();
  }

  private async applySettingsUpdate() {
    this.isDirty = true;
  };
}

