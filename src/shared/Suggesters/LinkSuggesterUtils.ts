import { App, FuzzyMatch, setIcon } from "obsidian";
import { LinkSuggestion } from "src/types/types";
import {
  AUDIO_TYPES,
  CODE_TYPES,
  ICON_NAME,
  IMAGE_TYPES,
  REG_LINKINDEX_INVALIDCHARS,
  VIDEO_TYPES,
} from "src/constants/constants";
import ExcalidrawPlugin from "src/core/main";

/**
 * Returns Obsidian link suggestions (files, aliases, unresolved) filtered for invalid characters.
 */
export const getLinkSuggestionsFiltered = (app: App): LinkSuggestion[] => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore Obsidian internal helper
  const suggestions = app.metadataCache.getLinkSuggestions?.();
  if (!suggestions) return [];
  return suggestions.filter((x: LinkSuggestion) => !x.path.match(REG_LINKINDEX_INVALIDCHARS));
};

/**
 * Standard rendering for link suggestions with icons and highlights.
 */
export const renderLinkSuggestion = (
  plugin: ExcalidrawPlugin,
  result: FuzzyMatch<LinkSuggestion>,
  itemEl: HTMLElement,
  emptyStateText: string,
) => {
  const { item, match: matches } = result || {};
  itemEl.addClass("mod-complex");
  const contentEl = itemEl.createDiv("suggestion-content");
  const auxEl = itemEl.createDiv("suggestion-aux");
  const titleEl = contentEl.createDiv("suggestion-title");
  const noteEl = contentEl.createDiv("suggestion-note");

  if (!item) {
    titleEl.setText(emptyStateText);
    itemEl.addClass("is-selected");
    return;
  }

  const path = item.file?.path ?? item.path;
  const pathLength = path.length - (item.file?.name.length ?? 0);
  const matchElements = matches.matches.map(() => createSpan("suggestion-highlight"));
  const itemText = item.path + (item.alias ? `|${item.alias}` : "");
  for (let i = pathLength; i < itemText.length; i++) {
    const match = matches.matches.find((m) => m[0] === i);
    if (match) {
      const element = matchElements[matches.matches.indexOf(match)];
      titleEl.appendChild(element);
      element.appendText(itemText.substring(match[0], match[1]));
      i += match[1] - match[0] - 1;
      continue;
    }
    titleEl.appendText(itemText[i]);
  }
  noteEl.setText(path);

  if (!item.file) {
    setIcon(auxEl, "ghost");
  } else if (plugin.isExcalidrawFile(item.file)) {
    setIcon(auxEl, ICON_NAME);
  } else if (item.file.extension === "md") {
    setIcon(auxEl, "square-pen");
  } else if (IMAGE_TYPES.includes(item.file.extension)) {
    setIcon(auxEl, "image");
  } else if (VIDEO_TYPES.includes(item.file.extension)) {
    setIcon(auxEl, "monitor-play");
  } else if (AUDIO_TYPES.includes(item.file.extension)) {
    setIcon(auxEl, "file-audio");
  } else if (CODE_TYPES.includes(item.file.extension)) {
    setIcon(auxEl, "file-code");
  } else if (item.file.extension === "canvas") {
    setIcon(auxEl, "layout-dashboard");
  } else if (item.file.extension === "pdf") {
    setIcon(auxEl, "book-open-text");
  } else {
    auxEl.setText(item.file.extension);
  }
};
