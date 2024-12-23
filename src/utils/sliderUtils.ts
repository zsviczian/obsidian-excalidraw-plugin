import { Setting } from "obsidian";

export type SliderSetting = {
  name: string;
  desc?: string | DocumentFragment; 
  min: number;
  max: number;
  step: number;
  value: number;
  minWidth?: string;
  onChange: (value: number) => void;
}

export const createSliderWithText = (
  container: HTMLElement, 
  settings: SliderSetting
): void => {
  let valueText: HTMLDivElement;

  new Setting(container)
    .setName(settings.name)
    .setDesc(settings.desc || '')
    .addSlider((slider) =>
      slider
        .setLimits(settings.min, settings.max, settings.step)
        .setValue(settings.value)
        .onChange(async (value) => {
          valueText.innerText = ` ${value.toString()}`;
          settings.onChange(value);
        }),
    )
    .settingEl.createDiv("", (el) => {
      valueText = el;
      el.style.minWidth = settings.minWidth || '2.3em';
      el.style.textAlign = "right";
      el.innerText = ` ${settings.value.toString()}`;
    });
}