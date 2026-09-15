import type { SettingDefinitionItem } from "src/types/obsidianDeclarativeSettings";

/** A setting row may render more than once from the same definition tree. */
export function cloneSettingFragment(
  value: string | DocumentFragment,
): string | DocumentFragment;
export function cloneSettingFragment(
  value: string | DocumentFragment | undefined,
): string | DocumentFragment | undefined;
export function cloneSettingFragment(
  value: string | DocumentFragment | undefined,
): string | DocumentFragment | undefined {
  return typeof value === "string" || value === undefined
    ? value
    : (value.cloneNode(true) as DocumentFragment);
}

/** Give Obsidian a fresh fragment each time it reads a rich description. */
export function makeDescriptionsReusable<K extends string>(
  items: SettingDefinitionItem<K>[],
): SettingDefinitionItem<K>[] {
  for (const item of items) {
    const description = item.desc;
    if (description && typeof description !== "string") {
      Object.defineProperty(item, "desc", {
        enumerable: true,
        configurable: true,
        get: () => cloneSettingFragment(description),
      });
    }
    if ("type" in item && item.items) {
      makeDescriptionsReusable(item.items);
    }
  }
  return items;
}
