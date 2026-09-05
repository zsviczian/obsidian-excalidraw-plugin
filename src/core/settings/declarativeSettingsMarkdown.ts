/**
 * Markdown export for Obsidian's declarative settings tree.
 *
 * The exporter reads the declarations rather than the currently mounted page,
 * so nested and conditionally rendered settings remain discoverable in one
 * document.
 */

import { htmlToMarkdown } from "obsidian";
import type {
  SettingDefinition,
  SettingDefinitionItem,
} from "src/types/obsidianDeclarativeSettings";

interface MarkdownDefinitionMetadata {
  controlType?: string;
  omit?: boolean;
}

const definitionMetadata = new WeakMap<object, MarkdownDefinitionMetadata>();

/** Adds export-only metadata without exposing custom fields to Obsidian. */
export function annotateMarkdownDefinition<T extends object>(
  definition: T,
  metadata: MarkdownDefinitionMetadata,
): T {
  definitionMetadata.set(definition, metadata);
  return definition;
}

function toMarkdown(value: string | DocumentFragment | undefined): string {
  if (value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return htmlToMarkdown(value).trim();
  }

  return htmlToMarkdown(value.cloneNode(true) as DocumentFragment).trim();
}

function normalizeControlType(controlType: string): string {
  switch (controlType) {
    case "text":
      return "text input";
    case "number-dropdown":
      return "dropdown";
    case "textarea":
      return "text area";
    default:
      return controlType;
  }
}

function getControlType(definition: SettingDefinition): string | undefined {
  const metadata = definitionMetadata.get(definition);
  if (metadata?.controlType) {
    return normalizeControlType(metadata.controlType);
  }
  if ("control" in definition && definition.control) {
    return normalizeControlType(definition.control.type);
  }
  if ("render" in definition && definition.render) {
    return "custom control";
  }
  return undefined;
}

function renderSetting(definition: SettingDefinition): string | null {
  const metadata = definitionMetadata.get(definition);
  if (metadata?.omit) {
    return null;
  }

  const description = toMarkdown(definition.desc);
  const controlType = getControlType(definition);
  const typePrefix = controlType ? ` (${controlType})` : "";
  return `- **${definition.name}:**${typePrefix}${description ? ` ${description}` : ""}`;
}

function renderItems(
  items: readonly SettingDefinitionItem[],
  headingLevel: number,
): string[] {
  const output: string[] = [];

  for (const item of items) {
    if ("type" in item) {
      output.push(`${"#".repeat(headingLevel)} ${item.name}`);
      const description = toMarkdown(item.desc);
      if (description) {
        output.push(description);
      }
      if (item.items?.length) {
        output.push(...renderItems(item.items, headingLevel + 1));
      }
      continue;
    }

    const setting = renderSetting(item);
    if (setting) {
      output.push(setting);
    }
  }

  return output;
}

/** Converts a complete declarative settings tree into one Markdown document. */
export function declarativeSettingsToMarkdown(
  definitions: readonly SettingDefinitionItem[],
): string {
  const blocks = renderItems(definitions, 1);
  if (blocks.length === 0) {
    return "";
  }
  let markdown = "";
  let previousBlock = "";
  for (const block of blocks) {
    const separator =
      markdown.length === 0
        ? ""
        : previousBlock.startsWith("- **") && block.startsWith("- **")
          ? "\n"
          : "\n\n";
    markdown += `${separator}${block}`;
    previousBlock = block;
  }
  return `${markdown}\n`;
}
