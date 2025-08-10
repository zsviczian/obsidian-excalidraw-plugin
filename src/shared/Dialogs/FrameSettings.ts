import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import { t } from "src/lang/helpers";
import { CaptureUpdateAction } from "src/constants/constants";
import { FloatingModal } from "./FloatingModal";
import ExcalidrawView from "src/view/ExcalidrawView";
import { Setting } from "obsidian";

export const showFrameSettings = (view: ExcalidrawView) => {
  const {enabled, clip, name, outline} = view.excalidrawAPI.getAppState().frameRendering;
  
  // Create modal dialog
  const frameSettingsModal = new FloatingModal(view.app);
  
  frameSettingsModal.onOpen = () => {
    const {contentEl} = frameSettingsModal;
    
    contentEl.createEl("h1", {text: t("FRAME_SETTINGS_TITLE")});
    
    const settings = { enabled, clip, name, outline };

    // Add toggles
    const enableFramesSetting = new Setting(contentEl)
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

    const displayFrameNameSetting = new Setting(contentEl)
      .setName(t("FRAME_SETTIGNS_NAME"))
      .addToggle(toggle => toggle
        .setValue(settings.name)
        .onChange(value => settings.name = value)
      );

    const displayFrameOutlineSetting = new Setting(contentEl)
      .setName(t("FRAME_SETTINGS_OUTLINE"))
      .addToggle(toggle => toggle
        .setValue(settings.outline)
        .onChange(value => settings.outline = value)
      );

    const enableFrameClippingSetting = new Setting(contentEl)
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
    new Setting(contentEl)
      .addButton(button => button
        .setButtonText("OK")
        .onClick(() => {
          // Update appState with new settings
          view.updateScene({
            // @ts-ignore
            appState: {
              frameRendering: settings
            },
            captureUpdate: CaptureUpdateAction.NEVER,
          });
          frameSettingsModal.close();
        })
      );
  };

  frameSettingsModal.open();
};

// Function to hide or show a component
function hideComponent(comp:any, value:any) {
  comp.settingEl.style.display = value ? "none" : "";
}
