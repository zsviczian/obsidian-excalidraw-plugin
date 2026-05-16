import { Setting } from "obsidian";
import { DEVICE } from "src/constants/constants";
import { t } from "src/lang/helpers";
import {
  ModifierKeySet,
  ModifierSetType,
  modifierKeyTooltipMessages,
} from "src/utils/modifierkeyHelper";

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
    private update?: () => void,
  ) {
    this.isMacOS = DEVICE.isMacOS || DEVICE.isIOS;
  }

  render() {
    const platform = this.isMacOS ? "Mac" : "Win";
    const modifierKeysConfig = this.modifierKeyConfig[platform];
    const tooltipMessages = modifierKeyTooltipMessages() as Record<
      string,
      Record<string, string>
    >;

    Object.entries(CATEGORIES).forEach(([modifierSetType, label]) => {
      const detailsEl = this.contentEl.createEl("details");
      detailsEl.createEl("summary", {
        text: label,
        cls: "excalidraw-setting-h4",
      });

      const modifierKeys = modifierKeysConfig[modifierSetType];
      detailsEl.createDiv({
        text:
          t("DEFAULT_ACTION_DESC") +
          (tooltipMessages[modifierSetType]?.[modifierKeys.defaultAction] ??
            ""),
        cls: "setting-item-description",
      });
      // Ensure all LinkClickAction rules have ctrl_cmd enabled
      if (modifierSetType === "LinkClickAction") {
        let dirty = false;
        modifierKeys.rules.forEach((rule) => {
          if (!rule.ctrl_cmd) {
            rule.ctrl_cmd = true;
            dirty = true;
          }
        });
        if (dirty) {
          this.update?.();
        }
      }

      // Column header row
      const headerSetting = new Setting(detailsEl);
      headerSetting.settingEl.addClass("modifier-key-header-row");
      headerSetting.infoEl.remove();
      [
        "SHIFT",
        this.isMacOS ? "CMD" : "CTRL",
        this.isMacOS ? "OPT" : "ALT",
        this.isMacOS ? "CTRL" : "META",
      ].forEach((key) => {
        headerSetting.controlEl.createEl("span", {
          text: key,
          cls: "modifier-key-col-header",
        });
      });

      Object.entries(modifierKeys.rules).forEach(([_, rule]) => {
        const setting = new Setting(detailsEl).setName(
          tooltipMessages[modifierSetType]?.[rule.result],
        );

        setting.addToggle((toggle) =>
          toggle
            .setValue(rule.shift)
            .setTooltip("SHIFT")
            .onChange((value) => {
              rule.shift = value;
              this.update();
            }),
        );
        setting.addToggle((toggle) => {
          const isLinkClick = modifierSetType === "LinkClickAction";
          toggle
            .setValue(isLinkClick ? true : rule.ctrl_cmd)
            .setTooltip(this.isMacOS ? "CMD" : "CTRL")
            .onChange((value) => {
              rule.ctrl_cmd = value;
              this.update();
            });
          if (isLinkClick || this.isMacOS) {
            // CMD is always required for link-click actions (Excalidraw detects
            // the click via CMD being held). On macOS, CMD is also reserved for
            // non-link-click actions.
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
            }),
        );
        setting.addToggle((toggle) =>
          toggle
            .setValue(rule.meta_ctrl)
            .setTooltip(this.isMacOS ? "CTRL" : "META")
            .onChange((value) => {
              rule.meta_ctrl = value;
              this.update();
            }),
        );
      });
    });
  }
}
