import { App, FuzzyMatch, prepareFuzzySearch, setIcon } from "obsidian";
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
  const filtered = suggestions.filter((x: LinkSuggestion) => !x.path.match(REG_LINKINDEX_INVALIDCHARS));

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  const isRecent = (s: LinkSuggestion) => !!s.file && now - s.file.stat.mtime <= weekMs;

  return filtered.sort((a: LinkSuggestion, b: LinkSuggestion) => {
    const aRecent = isRecent(a);
    const bRecent = isRecent(b);

    if (aRecent !== bRecent) {
      return aRecent ? -1 : 1; // recent first
    }

    if (aRecent && bRecent && a.file && b.file && a.file.stat.mtime !== b.file.stat.mtime) {
      return b.file.stat.mtime - a.file.stat.mtime; // newer recent first
    }

    const aKey = `${a.path}${a.alias ?? ""}`.toLowerCase();
    const bKey = `${b.path}${b.alias ?? ""}`.toLowerCase();
    return aKey.localeCompare(bKey);
  });
};

/**
 * Returns fuzzy matches sorted by fuzzy score, then recency, then name for stability.
 */
export const getSortedLinkMatches = (
  term: string,
  items: LinkSuggestion[],
): FuzzyMatch<LinkSuggestion>[] => {
  const search = prepareFuzzySearch(term);
  const matches = items
    .map((item) => {
      const target = `${item.path}${item.alias ? `|${item.alias}` : ""}`;
      const matchFull = search(target);

      if (!item.alias) {
        return matchFull ? { item, match: matchFull } : null;
      }

      // Also search alias alone; if better, shift ranges to alias segment in the full string
      const matchAliasOnly = search(item.alias);
      let best = matchFull;

      if (matchAliasOnly && (!best || matchAliasOnly.score > best.score)) {
        const aliasOffset = item.path.length + 1; // position where alias starts in "path|alias"
        const shiftedMatches = matchAliasOnly.matches.map(([from, to]) => [from + aliasOffset, to + aliasOffset]) as [number, number][];
        best = { ...matchAliasOnly, matches: shiftedMatches } as typeof matchAliasOnly;
      }

      return best ? { item, match: best } : null;
    })
    .filter(Boolean) as FuzzyMatch<LinkSuggestion>[];

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const isRecent = (s: LinkSuggestion) => !!s.file && now - s.file.stat.mtime <= weekMs;

  return matches.sort((a, b) => {
    const aScore = a?.match?.score ?? 0;
    const bScore = b?.match?.score ?? 0;
    if (aScore !== bScore) return bScore - aScore;

    const aRecent = isRecent(a.item);
    const bRecent = isRecent(b.item);
    if (aRecent !== bRecent) return aRecent ? -1 : 1; // recent first

    if (aRecent && bRecent && a.item.file && b.item.file && a.item.file.stat.mtime !== b.item.file.stat.mtime) {
      return b.item.file.stat.mtime - a.item.file.stat.mtime; // newer recent first
    }

    const aKey = `${a.item.path}${a.item.alias ?? ""}`.toLowerCase();
    const bKey = `${b.item.path}${b.item.alias ?? ""}`.toLowerCase();
    return aKey.localeCompare(bKey);
  });
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
  // For unresolved (ghost) files, highlight the full path. For resolved files, skip folder prefixes.
  const pathLength = item.file ? path.length - (item.file?.name.length ?? 0) : 0;
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
