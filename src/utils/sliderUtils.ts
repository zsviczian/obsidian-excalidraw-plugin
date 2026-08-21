import { Setting } from "obsidian";
import { setStyle } from "./styleUtils";

export type SliderSetting = {
  name: string | DocumentFragment;
  desc?: string | DocumentFragment;
  min: number;
  max: number;
  step: number;
  value: number;
  minWidth?: string;
  onChange: (value: number) => void | Promise<void>;
};

export const createSliderWithText = (
  container: HTMLElement,
  settings: SliderSetting,
): void => {
  configureSliderWithText(new Setting(container), settings);
};

/**
 * Configures an existing setting row with the plugin's slider-plus-value UI.
 * This supports declarative `render` callbacks, where Obsidian owns creation
 * of the row but the plugin must preserve its established slider layout.
 */
export const configureSliderWithText = (
  setting: Setting,
  settings: SliderSetting,
): void => {
  let valueText: HTMLDivElement;

  setting
    .setName(settings.name)
    .setDesc(settings.desc || "")
    .addSlider((slider) =>
      slider
        .setLimits(settings.min, settings.max, settings.step)
        .setValue(settings.value)
        .onChange(async (value) => {
          valueText.innerText = ` ${value.toString()}`;
          await settings.onChange(value);
        }),
    )
    .settingEl.createDiv("", (el) => {
      valueText = el;
      setStyle(el, {
        minWidth: settings.minWidth || "2.3em",
        textAlign: "right",
      });
      el.innerText = ` ${settings.value.toString()}`;
    });
};
