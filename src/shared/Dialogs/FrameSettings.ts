import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import { t } from "src/lang/helpers";

export const showFrameSettings = (ea: ExcalidrawAutomate) => {
  const {enabled, clip, name, outline} = ea.getExcalidrawAPI().getAppState().frameRendering;
  
  // Create modal dialog
  const frameSettingsModal = new ea.obsidian.Modal(ea.plugin.app);
  
  frameSettingsModal.onOpen = () => {
    const {contentEl} = frameSettingsModal;
    
    contentEl.createEl("h1", {text: t("FRAME_SETTINGS_TITLE")});
    
    const settings = { enabled, clip, name, outline };

    // Add toggles
    const enableFramesSetting = new ea.obsidian.Setting(contentEl)
      .setName(t("FRAME_SETTINGS_ENABLE"))
      .addToggle(toggle => toggle
        .setValue(settings.enabled)
        .onChange(value => {
          settings.enabled = value;
          hideComponent(displayFrameNameSetting, !value);
          hideComponent(displayFrameOutlineSetting, !value);
          hideComponent(enableFrameClippingSetting, !value);
        })
      );

    const displayFrameNameSetting = new ea.obsidian.Setting(contentEl)
      .setName(t("FRAME_SETTIGNS_NAME"))
      .addToggle(toggle => toggle
        .setValue(settings.name)
        .onChange(value => settings.name = value)
      );

    const displayFrameOutlineSetting = new ea.obsidian.Setting(contentEl)
      .setName(t("FRAME_SETTINGS_OUTLINE"))
      .addToggle(toggle => toggle
        .setValue(settings.outline)
        .onChange(value => settings.outline = value)
      );

    const enableFrameClippingSetting = new ea.obsidian.Setting(contentEl)
      .setName(t("FRAME_SETTINGS_CLIP"))
      .addToggle(toggle => toggle
        .setValue(settings.clip)
        .onChange(value => settings.clip = value)
      );

    // Hide or show components based on initial state
    hideComponent(displayFrameNameSetting, !settings.enabled);
    hideComponent(displayFrameOutlineSetting, !settings.enabled);
    hideComponent(enableFrameClippingSetting, !settings.enabled);

    // Add OK button
    new ea.obsidian.Setting(contentEl)
      .addButton(button => button
        .setButtonText("OK")
        .onClick(() => {
          // Update appState with new settings
          ea.viewUpdateScene({
            // @ts-ignore
            appState: {
              frameRendering: settings
            },
            storeAction: "update",
          });
          frameSettingsModal.close();
        })
      );
  };

  frameSettingsModal.onClose = () => {
    ea.destroy();
  }
  frameSettingsModal.open();
};

// Function to hide or show a component
function hideComponent(comp:any, value:any) {
  comp.settingEl.style.display = value ? "none" : "";
}
