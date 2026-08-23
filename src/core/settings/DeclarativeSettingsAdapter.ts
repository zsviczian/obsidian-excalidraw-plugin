/**
 * Obsidian 1.13 declarative adapter for canonical setting specifications.
 */

import type { SettingBindingRegistry } from "src/core/settings/SettingBindingRegistry";
import type { LegacySettingsAdapter } from "src/core/settings/LegacySettingsAdapter";
import type {
  SettingBindingKey,
  SettingSpec,
} from "src/core/settings/settingSpecs";
import type {
  SettingDefinition,
} from "src/types/obsidianDeclarativeSettings";
import { annotateMarkdownDefinition } from "src/core/settings/declarativeSettingsMarkdown";

/** Converts canonical setting rows into Obsidian 1.13 definitions. */
export class DeclarativeSettingsAdapter {
  private readonly bindings: SettingBindingRegistry;
  private readonly legacyAdapter: LegacySettingsAdapter;

  constructor(
    bindings: SettingBindingRegistry,
    legacyAdapter: LegacySettingsAdapter,
  ) {
    this.bindings = bindings;
    this.legacyAdapter = legacyAdapter;
  }

  /** Starts a definition build and invalidates bindings from the prior build. */
  beginBuild(): void {
    this.bindings.clear();
  }

  /** Converts a flat batch and rebuilds its binding registry. */
  toDefinitions(
    specs: readonly SettingSpec[],
  ): SettingDefinition<SettingBindingKey>[] {
    this.beginBuild();
    return specs.map((spec) => this.toDefinition(spec));
  }

  /** Converts one canonical row during the current definition build. */
  toDefinition(spec: SettingSpec): SettingDefinition<SettingBindingKey> {
    if (this.requiresCustomRender(spec)) {
      return this.toRenderedDefinition(spec);
    }

    this.bindings.register(spec);
    const base = {
      name: this.toSearchText(spec.name),
      desc: spec.desc,
      aliases: spec.aliases,
      searchable: spec.searchable,
      visible: spec.visible,
    };
    const control = spec.control;
    switch (control.type) {
      case "toggle":
        return {
          ...base,
          control: {
            type: "toggle",
            key: control.key,
            disabled: control.disabled,
          },
        };
      case "text":
        return {
          ...base,
          control: {
            type: "text",
            key: control.key,
            placeholder: control.placeholder,
            disabled: control.disabled,
          },
        };
      case "dropdown":
        return {
          ...base,
          control: {
            type: "dropdown",
            key: control.key,
            options: Object.fromEntries(
              control.options.map(({ value, label }) => [value, label]),
            ),
            disabled: control.disabled,
          },
        };
      case "number-dropdown":
        return {
          ...base,
          control: {
            type: "dropdown",
            key: control.key,
            options: Object.fromEntries(
              control.options.map(({ value, label }) => [
                value.toString(),
                label,
              ]),
            ),
            disabled: control.disabled,
          },
        };
      case "slider":
        return {
          ...base,
          control: {
            type: "slider",
            key: control.key,
            min: control.min,
            max: control.max,
            step: control.step,
            disabled: control.disabled,
          },
        };
    }
  }

  private requiresCustomRender(spec: SettingSpec): boolean {
    if (typeof spec.name !== "string") {
      return true;
    }
    const control = spec.control;
    return (
      (control.type === "text" &&
        Boolean(control.capture || control.sanitize || control.vaultPath)) ||
      (control.type === "slider" && control.minWidth !== undefined)
    );
  }

  private toRenderedDefinition(
    spec: SettingSpec,
  ): SettingDefinition<SettingBindingKey> {
    return annotateMarkdownDefinition(
      {
        name: this.toSearchText(spec.name),
        desc:
          spec.desc === undefined ? undefined : this.toSearchText(spec.desc),
        aliases: spec.aliases,
        searchable: spec.searchable,
        visible: spec.visible,
        render: (setting) => this.legacyAdapter.configure(setting, spec),
      },
      { controlType: spec.control.type },
    );
  }

  private toSearchText(value: string | DocumentFragment): string {
    return typeof value === "string" ? value : (value.textContent ?? "");
  }
}
