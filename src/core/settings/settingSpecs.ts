/**
 * Canonical setting-row specifications shared by the legacy and declarative
 * settings adapters.
 */

import type { TextComponent } from "obsidian";
import type { ExcalidrawSettings } from "src/core/settingsDefaults";

/** Keys of {@link ExcalidrawSettings} whose value type is boolean. */
export type BooleanSettingKey = {
  [K in keyof ExcalidrawSettings]: ExcalidrawSettings[K] extends boolean
    ? K
    : never;
}[keyof ExcalidrawSettings];

/** Keys whose value type is exactly `string`, excluding literal unions. */
export type StringSettingKey = {
  [K in keyof ExcalidrawSettings]: string extends ExcalidrawSettings[K]
    ? ExcalidrawSettings[K] extends string
      ? K
      : never
    : never;
}[keyof ExcalidrawSettings];

/** Keys whose value is a string or a narrower string-literal union. */
export type StringLikeSettingKey = {
  [K in keyof ExcalidrawSettings]: ExcalidrawSettings[K] extends string
    ? K
    : never;
}[keyof ExcalidrawSettings];

/** Keys of {@link ExcalidrawSettings} whose value type is number. */
export type NumberSettingKey = {
  [K in keyof ExcalidrawSettings]: ExcalidrawSettings[K] extends number
    ? K
    : never;
}[keyof ExcalidrawSettings];

/** Every persisted key currently supported by a canonical row binding. */
export type SettingBindingKey =
  | BooleanSettingKey
  | StringLikeSettingKey
  | NumberSettingKey;

type SettingControlBase<Value, Key extends SettingBindingKey> = {
  key: Key;
  before?: (value: Value) => void | Promise<void>;
  after?: (value: Value) => void | Promise<void>;
  afterUpdate?: (value: Value) => void | Promise<void>;
  reload?: boolean;
  disabled?: boolean | (() => boolean);
};

/** Canonical toggle control, including support for an inverted stored value. */
export type ToggleControl = SettingControlBase<boolean, BooleanSettingKey> & {
  type: "toggle";
  negate?: boolean;
};

/** Canonical text control and its legacy-only component integrations. */
export type TextControl = SettingControlBase<string, StringSettingKey> & {
  type: "text";
  placeholder?: string;
  sanitize?: (value: string) => string;
  vaultPath?: {
    kind: "file" | "folder";
    options?: {
      optional?: boolean;
      extensions?: readonly string[];
      resolvePath?: (value: string) => string;
      createFolder?: boolean;
      validate?: boolean;
    };
  };
  capture?: (text: TextComponent) => void;
};

/** Canonical string-valued dropdown control. */
export type DropdownControl = SettingControlBase<
  string,
  StringLikeSettingKey
> & {
  type: "dropdown";
  options: readonly { value: string; label: string }[];
};

/** Canonical numeric value represented by string-valued dropdown options. */
export type NumberDropdownControl = SettingControlBase<
  number,
  NumberSettingKey
> & {
  type: "number-dropdown";
  options: readonly { value: number; label: string }[];
  parse?: "int" | "float";
};

/** Canonical numeric slider control. */
export type SliderControl = SettingControlBase<number, NumberSettingKey> & {
  type: "slider";
  min: number;
  max: number;
  step: number;
  minWidth?: string;
  scale?: number;
};

/** Controls currently understood by both settings adapters. */
export type SettingControlSpec =
  | ToggleControl
  | TextControl
  | DropdownControl
  | NumberDropdownControl
  | SliderControl;

/**
 * One canonical setting row. Search metadata is declarative-only; visibility
 * and disabled predicates are interpreted by both adapters.
 */
export interface SettingSpec {
  name: string | DocumentFragment;
  desc?: string | DocumentFragment;
  aliases?: string[];
  searchable?: boolean | (() => boolean);
  visible?: boolean | (() => boolean);
  control: SettingControlSpec;
}
