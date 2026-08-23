/**
 * Imperative renderer for canonical setting-row specifications.
 */

import { Setting, type TextComponent } from "obsidian";
import type { SettingBindingRegistry } from "src/core/settings/SettingBindingRegistry";
import type {
  SettingSpec,
  TextControl,
} from "src/core/settings/settingSpecs";
import { configureSliderWithText } from "src/utils/sliderUtils";

/** Legacy-only services used by custom text controls. */
export interface LegacySettingsAdapterHost {
  addVaultPathSupport(
    setting: Setting,
    text: TextComponent,
    kind: "file" | "folder",
    options: NonNullable<TextControl["vaultPath"]>["options"],
  ): void;
}

/** Builds or configures imperative Obsidian setting rows from canonical specs. */
export class LegacySettingsAdapter {
  constructor(
    private readonly bindings: SettingBindingRegistry,
    private readonly host: LegacySettingsAdapterHost,
  ) {}

  /**
   * Creates one legacy row. Slider return behavior remains `undefined` for
   * compatibility with the former in-class interpreter.
   */
  render(container: HTMLElement, spec: SettingSpec): Setting | undefined {
    const visible =
      typeof spec.visible === "function"
        ? spec.visible()
        : (spec.visible ?? true);
    if (!visible) {
      return undefined;
    }
    const setting = new Setting(container);
    this.configure(setting, spec);
    return spec.control.type === "slider" ? undefined : setting;
  }

  /** Configures a row supplied by either the legacy or declarative host. */
  configure(setting: Setting, spec: SettingSpec): void {
    const control = spec.control;
    const disabled =
      typeof control.disabled === "function"
        ? control.disabled()
        : (control.disabled ?? false);
    if (control.type === "slider") {
      configureSliderWithText(setting, {
        name: spec.name,
        desc: spec.desc,
        value: this.bindings.getSpecValue(spec) as number,
        min: control.min,
        max: control.max,
        step: control.step,
        minWidth: control.minWidth,
        onChange: (value) => this.bindings.setLegacySpecValue(spec, value),
      });
      setting.setDisabled(disabled);
      return;
    }

    setting.setName(spec.name);
    if (spec.desc) {
      setting.setDesc(spec.desc);
    }

    switch (control.type) {
      case "toggle":
        setting.addToggle((toggle) =>
          toggle
            .setValue(this.bindings.getSpecValue(spec) as boolean)
            .onChange((value) =>
              this.bindings.setLegacySpecValue(spec, value),
            ),
        );
        break;
      case "text":
        setting.addText((text) => {
          control.capture?.(text);
          if (control.placeholder !== undefined) {
            text.setPlaceholder(control.placeholder);
          }
          text
            .setValue(this.bindings.getSpecValue(spec) as string)
            .onChange((value) =>
              this.bindings.setLegacySpecValue(spec, value, () => {
                if (control.sanitize) {
                  text.setValue(this.bindings.getSpecValue(spec) as string);
                }
              }),
            );
          if (control.vaultPath) {
            this.host.addVaultPathSupport(
              setting,
              text,
              control.vaultPath.kind,
              control.vaultPath.options,
            );
          }
        });
        break;
      case "dropdown":
        setting.addDropdown((dropdown) => {
          for (const option of control.options) {
            dropdown.addOption(option.value, option.label);
          }
          dropdown
            .setValue(this.bindings.getSpecValue(spec) as string)
            .onChange((value) =>
              this.bindings.setLegacySpecValue(spec, value),
            );
        });
        break;
      case "number-dropdown":
        setting.addDropdown((dropdown) => {
          for (const option of control.options) {
            dropdown.addOption(option.value.toString(), option.label);
          }
          dropdown
            .setValue(this.bindings.getSpecValue(spec) as string)
            .onChange((value) =>
              this.bindings.setLegacySpecValue(spec, value),
            );
        });
    }
    // Setting#setDisabled only affects controls that already exist. Apply the
    // initial predicate after configuring the row so dependent controls start
    // in the same state in both legacy and declarative render paths.
    setting.setDisabled(disabled);
  }
}
