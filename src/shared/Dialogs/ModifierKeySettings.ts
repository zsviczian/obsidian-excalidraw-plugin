import { Setting } from "obsidian";
import { DEVICE } from "src/constants/constants";
import { t } from "src/lang/helpers";
import { ModifierKeySet, ModifierSetType, modifierKeyTooltipMessages } from "src/utils/modifierkeyHelper";

type ModifierKeyCategories = Partial<{
  [modifierSetType in ModifierSetType]: string;
}>;

const CATEGORIES: ModifierKeyCategories = {
  WebBrowserDragAction: t("WEB_BROWSER_DRAG_ACTION"),
  LocalFileDragAction: t("LOCAL_FILE_DRAG_ACTION"),
  InternalDragAction: t("INTERNAL_DRAG_ACTION"),
  LinkClickAction: t("PANE_TARGET"),
};

export class ModifierKeySettingsComponent {
  private isMacOS: boolean;

  constructor(
    private contentEl: HTMLElement,
    private modifierKeyConfig: {
      Mac: Record<string, ModifierKeySet>;
      Win: Record<string, ModifierKeySet>;
    },
    private update?: Function,
  ) {
    this.isMacOS = (DEVICE.isMacOS || DEVICE.isIOS);
  }

  render() {
    const platform = this.isMacOS ? "Mac" : "Win";
    const modifierKeysConfig = this.modifierKeyConfig[platform];

    Object.entries(CATEGORIES).forEach(([modifierSetType, label]) => {
      const detailsEl = this.contentEl.createEl("details");
      detailsEl.createEl("summary", { 
        text: label,
        cls: "excalidraw-setting-h4",
      });
      
      const modifierKeys = modifierKeysConfig[modifierSetType];
      detailsEl.createDiv({
        //@ts-ignore
        text: t("DEFAULT_ACTION_DESC") + modifierKeyTooltipMessages()[modifierSetType][modifierKeys.defaultAction],
        cls: "setting-item-description"
      });
      Object.entries(modifierKeys.rules).forEach(([action, rule]) => {
        const setting = new Setting(detailsEl)
        //@ts-ignore
          .setName(modifierKeyTooltipMessages()[modifierSetType][rule.result]);
        
        setting.addToggle((toggle) =>
          toggle
            .setValue(rule.shift)
            .setTooltip("SHIFT")
            .onChange((value) => {
              rule.shift = value;
              this.update();
            })
          );
        setting.addToggle((toggle) => {
          toggle
            .setValue(rule.ctrl_cmd)
            .setTooltip(this.isMacOS ? "CMD" : "CTRL")
            .onChange((value) => {
              rule.ctrl_cmd = value;
              this.update();
            })
          if(this.isMacOS && modifierSetType !== "LinkClickAction") {
            toggle.setDisabled(true);
            toggle.toggleEl.style.opacity = "0.5";
          }
        });
        
        setting.addToggle((toggle) =>
          toggle
            .setValue(rule.alt_opt)
            .setTooltip(this.isMacOS ? "OPT" : "ALT")
            .onChange((value) => {
              rule.alt_opt = value;
              this.update();
            })
          );
        setting.addToggle((toggle) =>
          toggle
            .setValue(rule.meta_ctrl)
            .setTooltip(this.isMacOS ? "CTRL" : "META")
            .onChange((value) => {
              rule.meta_ctrl = value;
              this.update();
            })
          );
      });
    });
  }
}
