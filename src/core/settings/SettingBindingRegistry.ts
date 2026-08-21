/**
 * Typed value and persistence bridge for canonical setting specifications.
 */

import type { ExcalidrawSettings } from "src/core/settingsDefaults";
import type {
  SettingBindingKey,
  SettingControlSpec,
  SettingSpec,
} from "src/core/settings/settingSpecs";

/** Services required to persist a canonical setting mutation. */
export interface SettingBindingHost {
  getSettings(): ExcalidrawSettings;
  queueSettingsUpdate(requestReloadDrawings: boolean): Promise<void>;
}

/**
 * Resolves declarative control keys and applies the same transformations,
 * hooks, save queue, and pending actions as the legacy controls.
 */
export class SettingBindingRegistry {
  private readonly bindings = new Map<SettingBindingKey, SettingSpec>();
  private readonly host: SettingBindingHost;

  constructor(host: SettingBindingHost) {
    this.host = host;
  }

  /** Clears bindings before a fresh declarative definition build. */
  clear(): void {
    this.bindings.clear();
  }

  /** Registers one native declarative control binding for the current build. */
  register(spec: SettingSpec): void {
    const { key } = spec.control;
    if (this.bindings.has(key)) {
      throw new Error(`Duplicate declarative setting binding: ${key}`);
    }
    this.bindings.set(key, spec);
  }

  /** Reads a registered declarative control value. */
  getControlValue(key: string): unknown {
    return this.getSpecValue(this.getBinding(key));
  }

  /** Writes a registered declarative control value and awaits persistence. */
  setControlValue(key: string, value: unknown): Promise<void> {
    return this.setSpecValue(this.getBinding(key), value);
  }

  /** Reads the UI-facing value for either adapter. */
  getSpecValue(spec: SettingSpec): boolean | string | number {
    const settings = this.host.getSettings();
    const control = spec.control;
    switch (control.type) {
      case "toggle": {
        const storedValue = settings[control.key];
        return control.negate ? !storedValue : storedValue;
      }
      case "number-dropdown":
        return settings[control.key].toString();
      case "slider":
        return settings[control.key] * (control.scale ?? 1);
      default:
        return settings[control.key];
    }
  }

  /** Applies a UI-facing value from either adapter. */
  setSpecValue(
    spec: SettingSpec,
    value: unknown,
    afterWrite?: () => void,
  ): Promise<void> {
    return this.setSpecValueInternal(spec, value, afterWrite, true);
  }

  /**
   * Applies a legacy UI value without extending the component callback until
   * queued disk persistence completes.
   */
  setLegacySpecValue(
    spec: SettingSpec,
    value: unknown,
    afterWrite?: () => void,
  ): Promise<void> {
    return this.setSpecValueInternal(spec, value, afterWrite, false);
  }

  private async setSpecValueInternal(
    spec: SettingSpec,
    value: unknown,
    afterWrite: (() => void) | undefined,
    awaitPersistence: boolean,
  ): Promise<void> {
    const control = spec.control;
    switch (control.type) {
      case "toggle": {
        const nextValue = this.requireBoolean(control, value);
        await control.before?.(nextValue);
        this.setSettingValue(control.key, control.negate ? !nextValue : nextValue);
        afterWrite?.();
        await control.after?.(nextValue);
        await this.persistAndRunAfterUpdate(
          control,
          nextValue,
          awaitPersistence,
        );
        return;
      }
      case "text": {
        const nextValue = this.requireString(control, value);
        await control.before?.(nextValue);
        this.setSettingValue(
          control.key,
          control.sanitize?.(nextValue) ?? nextValue,
        );
        afterWrite?.();
        await control.after?.(nextValue);
        await this.persistAndRunAfterUpdate(
          control,
          nextValue,
          awaitPersistence,
        );
        return;
      }
      case "dropdown": {
        const nextValue = this.requireString(control, value);
        await control.before?.(nextValue);
        this.setSettingValue(control.key, nextValue);
        afterWrite?.();
        await control.after?.(nextValue);
        await this.persistAndRunAfterUpdate(
          control,
          nextValue,
          awaitPersistence,
        );
        return;
      }
      case "number-dropdown": {
        const rawValue = this.requireString(control, value);
        const nextValue =
          control.parse === "int" ? parseInt(rawValue) : parseFloat(rawValue);
        await control.before?.(nextValue);
        this.setSettingValue(control.key, nextValue);
        afterWrite?.();
        await control.after?.(nextValue);
        await this.persistAndRunAfterUpdate(
          control,
          nextValue,
          awaitPersistence,
        );
        return;
      }
      case "slider": {
        const displayValue = this.requireNumber(control, value);
        await control.before?.(displayValue);
        this.setSettingValue(
          control.key,
          displayValue / (control.scale ?? 1),
        );
        afterWrite?.();
        await control.after?.(displayValue);
        await this.persistAndRunAfterUpdate(
          control,
          displayValue,
          awaitPersistence,
        );
      }
    }
  }

  private getBinding(key: string): SettingSpec {
    const binding = this.bindings.get(key as SettingBindingKey);
    if (!binding) {
      throw new Error(`Unknown declarative setting binding: ${key}`);
    }
    return binding;
  }

  private setSettingValue<K extends keyof ExcalidrawSettings>(
    key: K,
    value: ExcalidrawSettings[K],
  ): void {
    this.host.getSettings()[key] = value;
  }

  private async persistAndRunAfterUpdate<Value>(
    control: SettingControlSpec & {
      afterUpdate?: (value: Value) => void | Promise<void>;
    },
    value: Value,
    awaitPersistence: boolean,
  ): Promise<void> {
    const persistence = this.host.queueSettingsUpdate(control.reload ?? false);
    if (awaitPersistence) {
      try {
        await control.afterUpdate?.(value);
      } finally {
        await persistence;
      }
      return;
    }
    await control.afterUpdate?.(value);
    void persistence;
  }

  private requireBoolean(control: SettingControlSpec, value: unknown): boolean {
    if (typeof value !== "boolean") {
      throw this.invalidValueError(control, "boolean");
    }
    return value;
  }

  private requireString(control: SettingControlSpec, value: unknown): string {
    if (typeof value !== "string") {
      throw this.invalidValueError(control, "string");
    }
    return value;
  }

  private requireNumber(control: SettingControlSpec, value: unknown): number {
    if (typeof value !== "number") {
      throw this.invalidValueError(control, "number");
    }
    return value;
  }

  private invalidValueError(
    control: SettingControlSpec,
    expectedType: string,
  ): TypeError {
    return new TypeError(
      `Invalid value for setting '${control.key}': expected ${expectedType}`,
    );
  }
}
