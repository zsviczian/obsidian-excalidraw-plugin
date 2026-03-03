import { Setting, DropdownComponent, App } from "obsidian";
import { t } from "src/lang/helpers";
import { ExcalidrawSettings } from "src/core/settings";
import { fragWithHTML, setLeftHandedMode, setUIMode } from "src/utils/utils";
import { DEVICE } from "src/constants/constants";

export type UIMode = "full" | "compact" | "tray" | "mobile";

//setDesktopUIMode(this.app, this.plugin.settings);


export class UIModeSettingsComponent {
  private containerEl: HTMLElement;
  private settings: ExcalidrawSettings;
  private app: App;
  private onChange: () => void;
  private reapplyButtonAction: ()=>void = null;

  constructor(
    containerEl: HTMLElement,
    settings: ExcalidrawSettings,
    app: App,
    onChange: () => void,
    reapplyButtonAction: ()=>void = null,
  ) {
    this.containerEl = containerEl;
    this.settings = settings;
    this.app = app;
    this.onChange = onChange;
    this.reapplyButtonAction = reapplyButtonAction;
  }

  render(): void {
    const { containerEl } = this;

    new Setting(containerEl)
      .setName(t("DESKTOP_UI_MODE_NAME"))
      .setDesc(t("DESKTOP_UI_MODE_DESC"))
      .addDropdown((dropdown: DropdownComponent) =>
        dropdown
          .addOption("full", t("MODE_FULL"))
          .addOption("compact", t("MODE_COMPACT"))
          .addOption("tray", t("MODE_TRAY"))
          .setValue(this.settings.desktopUIMode)
          .onChange((value: UIMode) => {
            this.settings.desktopUIMode = value;
            if (DEVICE.isDesktop) {
              setUIMode(this.app, this.settings);
            }
            this.onChange();
          }),
      );

    new Setting(containerEl)
      .setName(t("TABLET_UI_MODE_NAME"))
      .setDesc(t("TABLET_UI_MODE_DESC"))
      .addDropdown((dropdown: DropdownComponent) =>
        dropdown
          .addOption("full", t("MODE_FULL"))
          .addOption("compact", t("MODE_COMPACT"))
          .addOption("tray", t("MODE_TRAY"))
          .setValue(this.settings.tabletUIMode)
          .onChange((value: UIMode) => {
            this.settings.tabletUIMode = value;
            if (DEVICE.isTablet) {
              setUIMode(this.app, this.settings);
            }
            this.onChange();
          }),
      );

    new Setting(containerEl)
      .setName(t("PHONE_UI_MODE_NAME"))
      .setDesc(t("PHONE_UI_MODE_DESC"))
      .addDropdown((dropdown: DropdownComponent) =>
        dropdown
          .addOption("full", t("MODE_FULL"))
          .addOption("compact", t("MODE_COMPACT"))
          .addOption("tray", t("MODE_TRAY"))
          .addOption("mobile", t("MODE_PHONE"))
          .setValue(this.settings.phoneUIMode ?? "mobile")
          .onChange((value: UIMode) => {
            this.settings.phoneUIMode = value;
            if (DEVICE.isPhone) {
              setUIMode(this.app, this.settings);
            }
            this.onChange();
          }),
      );

    new Setting(containerEl)
      .setName(t("LEFTHANDED_MODE_NAME"))
      .setDesc(fragWithHTML(t("LEFTHANDED_MODE_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.isLeftHanded)
          .onChange(async (value) => {
            this.settings.isLeftHanded = value;
            //not clear why I need to do this. If I don't double apply the stylesheet changes 
            //then the style won't be applied in the popout windows
            setLeftHandedMode(value); 
            setTimeout(()=>setLeftHandedMode(value));
            this.onChange();
          }),
      );

    if (this.reapplyButtonAction) {
      new Setting(containerEl)
        .addButton((button) =>
          button
            .setButtonText(t("REAPPLY_UI_MODE_BUTTON"))
            .setCta()
            .onClick(() => {
              setUIMode(this.app, this.settings);
              this.reapplyButtonAction();
            }),
        );
    }

  }
}
