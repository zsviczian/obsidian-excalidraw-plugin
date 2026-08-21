/**
 * Type-only compatibility boundary for Obsidian's declarative settings API.
 *
 * The project intentionally remains compiled against Obsidian 1.8.7. These
 * structural types mirror only the Obsidian 1.13.0 surface used by the
 * settings migration and must not be treated as evidence that the methods are
 * available at runtime. Keep runtime calls behind
 * {@link getDeclarativeSettingTabRuntime}.
 *
 * Features introduced after 1.13.0 are deliberately excluded. When the
 * pinned Obsidian dependency eventually includes these declarations, replace
 * this file with type-only imports from `obsidian`.
 */

import type {
  HexString,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
} from "obsidian";

type SettingControlBase<V, K extends string> = {
  key: K;
  defaultValue?: V;
  validate?: (value: V) => string | void | Promise<string | void>;
  disabled?: boolean | (() => boolean);
};

type SettingToggleControl<K extends string> = SettingControlBase<boolean, K> & {
  type: "toggle";
};

type SettingDropdownControl<K extends string> = SettingControlBase<string, K> & {
  type: "dropdown";
  options: Record<string, string>;
};

type SettingTextControl<K extends string> = SettingControlBase<string, K> & {
  type: "text";
  placeholder?: string;
};

type SettingTextAreaControl<K extends string> = SettingControlBase<string, K> & {
  type: "textarea";
  placeholder?: string;
  rows?: number;
};

type SettingFileControl<K extends string> = SettingControlBase<string, K> & {
  type: "file";
  placeholder?: string;
  filter?: (file: TFile) => boolean;
};

type SettingFolderControl<K extends string> = SettingControlBase<string, K> & {
  type: "folder";
  placeholder?: string;
  filter?: (folder: TFolder) => boolean;
  includeRoot?: boolean;
};

type SettingSliderControl<K extends string> = SettingControlBase<number, K> & {
  type: "slider";
  min: number;
  max: number;
  step: number;
};

type SettingColorControl<K extends string> = SettingControlBase<HexString, K> & {
  type: "color";
};

type SettingControl<K extends string> =
  | SettingToggleControl<K>
  | SettingDropdownControl<K>
  | SettingTextControl<K>
  | SettingTextAreaControl<K>
  | SettingFileControl<K>
  | SettingFolderControl<K>
  | SettingSliderControl<K>
  | SettingColorControl<K>;

type SettingDefinitionBase = {
  name: string;
  desc?: string | DocumentFragment;
  aliases?: string[];
  searchable?: boolean | (() => boolean);
  visible?: boolean | (() => boolean);
};

type SettingDefinitionControl<K extends string> = SettingDefinitionBase & {
  control: SettingControl<K>;
  action?: never;
  render?: never;
};

type SettingDefinitionAction = SettingDefinitionBase & {
  action: (el: HTMLElement, index: number) => void;
  disabled?: boolean | (() => boolean);
  control?: never;
  render?: never;
};

/** Minimal structural surface passed to a declarative `render` callback. */
interface SettingGroupLike {
  listEl: HTMLElement;
}

type SettingDefinitionRender = SettingDefinitionBase & {
  render: (
    setting: Setting,
    group: SettingGroupLike,
  ) => void | (() => void);
  action?: never;
  control?: never;
};

type SettingDefinitionEmpty = SettingDefinitionBase & {
  action?: never;
  control?: never;
  render?: never;
};

type SettingDefinition<K extends string> =
  | SettingDefinitionControl<K>
  | SettingDefinitionAction
  | SettingDefinitionRender
  | SettingDefinitionEmpty;

type SettingDefinitionPage<K extends string> = {
  type: "page";
  name: string;
  desc?: string | DocumentFragment;
  items?: SettingDefinitionItem<K>[];
  visible?: boolean | (() => boolean);
};

type SettingDefinitionGroup<K extends string> = {
  type: "group";
  heading?: string;
  cls?: string;
  items?: (SettingDefinition<K> | SettingDefinitionPage<K>)[];
  visible?: boolean | (() => boolean);
};

/**
 * Minimal Obsidian 1.13.0 definition union used by this migration.
 *
 * This is intentionally a local structural equivalent rather than an
 * augmentation of the installed Obsidian 1.8.7 module.
 */
export type SettingDefinitionItem<K extends string = string> =
  | SettingDefinition<K>
  | SettingDefinitionGroup<K>
  | SettingDefinitionPage<K>;

/**
 * Obsidian 1.13.0 methods required by the declarative settings adapter.
 * Their presence must be checked at runtime before use.
 */
export interface DeclarativeSettingTabRuntime<K extends string = string> {
  getSettingDefinitions(): SettingDefinitionItem<K>[];
  getControlValue(key: string): unknown;
  setControlValue(key: string, value: unknown): void | Promise<void>;
  update(): void;
  refreshDomState(): void;
}

const DECLARATIVE_SETTING_TAB_METHODS = [
  "getSettingDefinitions",
  "getControlValue",
  "setControlValue",
  "update",
  "refreshDomState",
] as const satisfies readonly (keyof DeclarativeSettingTabRuntime)[];

/**
 * Returns the Obsidian 1.13.0 declarative settings facade when every required
 * runtime method exists, otherwise returns `null` for the legacy path.
 */
export function getDeclarativeSettingTabRuntime<K extends string = string>(
  tab: PluginSettingTab,
): (PluginSettingTab & DeclarativeSettingTabRuntime<K>) | null {
  const candidate = tab as unknown as Record<string, unknown>;
  if (
    !DECLARATIVE_SETTING_TAB_METHODS.every(
      (method) => typeof candidate[method] === "function",
    )
  ) {
    return null;
  }
  return tab as PluginSettingTab & DeclarativeSettingTabRuntime<K>;
}
