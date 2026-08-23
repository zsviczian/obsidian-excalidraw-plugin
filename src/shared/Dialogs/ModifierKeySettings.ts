import { Setting } from "obsidian";
import { DEVICE } from "src/constants/constants";
import { t } from "src/lang/helpers";
import {
  ModifierKeySet,
  ModifierSetType,
  modifierKeyTooltipMessages,
} from "src/utils/modifierkeyHelper";
import { setStyle } from "src/utils/styleUtils";

const CATEGORIES: Record<ModifierSetType, string> = {
  WebBrowserDragAction: t("WEB_BROWSER_DRAG_ACTION"),
  LocalFileDragAction: t("LOCAL_FILE_DRAG_ACTION"),
  InternalDragAction: t("INTERNAL_DRAG_ACTION"),
  LinkClickAction: t("PANE_TARGET"),
};

/** Modifier-key categories rendered by the settings component. */
export const MODIFIER_KEY_CATEGORIES = [
  "WebBrowserDragAction",
  "LocalFileDragAction",
  "InternalDragAction",
  "LinkClickAction",
] as const satisfies readonly ModifierSetType[];

/** Returns the localized heading for one modifier-key category. */
export const getModifierKeyCategoryName = (
  modifierSetType: ModifierSetType,
): string => CATEGORIES[modifierSetType];

export class ModifierKeySettingsComponent {
  private isMacOS: boolean;

  constructor(
    private contentEl: HTMLElement,
    private modifierKeyConfig: {
      Mac: Record<string, ModifierKeySet>;
      Win: Record<string, ModifierKeySet>;
    },
    private update: () => void,
  ) {
    this.isMacOS = DEVICE.isMacOS || DEVICE.isIOS;
  }

  render(): void {
    MODIFIER_KEY_CATEGORIES.forEach((modifierSetType) =>
      this.renderCategory(modifierSetType, true),
    );
  }

  /** Renders one modifier-key category, optionally with its legacy fold. */
  renderCategory(
    modifierSetType: ModifierSetType,
    includeSummary: boolean,
  ): void {
    const platform = this.isMacOS ? "Mac" : "Win";
    const modifierKeysConfig = this.modifierKeyConfig[platform];
    const tooltipMessages = modifierKeyTooltipMessages() as Record<
      string,
      Record<string, string>
    >;

    const detailsEl = includeSummary
      ? this.contentEl.createEl("details")
      : this.contentEl;
    if (includeSummary) {
      detailsEl.createEl("summary", {
        text: getModifierKeyCategoryName(modifierSetType),
        cls: "excalidraw-setting-h4",
      });
    }

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
        this.update();
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
      headerSetting.controlEl.createSpan({
        text: key,
        cls: "modifier-key-col-header",
      });
    });

    modifierKeys.rules.forEach((rule) => {
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
          setStyle(toggle.toggleEl, { opacity: "0.5" });
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
  }
}
