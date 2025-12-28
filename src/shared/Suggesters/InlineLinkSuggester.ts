import {
  App,
  FuzzyMatch,
  prepareFuzzySearch,
  setIcon,
} from "obsidian";
import { SuggestionModal } from "./SuggestionModal";
import { LinkSuggestion } from "src/types/types";
import ExcalidrawPlugin from "src/core/main";
import {
  AUDIO_TYPES,
  CODE_TYPES,
  ICON_NAME,
  IMAGE_TYPES,
  REG_LINKINDEX_INVALIDCHARS,
  VIDEO_TYPES,
} from "src/constants/constants";

/**
 * Inline link suggester that attaches to a specific input element.
 */
export class InlineLinkSuggester extends SuggestionModal<LinkSuggestion> {
  private readonly getSourcePath: () => string | undefined;
  private readonly plugin: ExcalidrawPlugin;

  constructor(
    app: App,
    plugin: ExcalidrawPlugin,
    inputEl: HTMLInputElement,
    getSourcePath: () => string | undefined,
  ) {
    const items = InlineLinkSuggester.collectItems(app);
    super(app, inputEl, items);
    this.plugin = plugin;
    this.getSourcePath = getSourcePath;
    this.limit = 20;
    this.setPlaceholder("Start typing [[ to link...");
    this.emptyStateText = "No match";
  }


  getItems(): LinkSuggestion[] {
    //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/422
    return (
      this.app.metadataCache
        //@ts-ignore
        .getLinkSuggestions()
        //@ts-ignore
        .filter((x) => !x.path.match(REG_LINKINDEX_INVALIDCHARS))
    );
  }

  /**
   * Refreshes the suggestion data (e.g. when vault changes) without recreating the instance.
   */
  public refreshItems() {
    this.items = InlineLinkSuggester.collectItems(this.app);
  }

  private static collectItems(app: App): LinkSuggestion[] {
    // Obsidian core helper returns files, aliases, and unresolved links.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const suggestions = app.metadataCache.getLinkSuggestions?.();
    if (!suggestions) return [];
    return suggestions.filter((x: LinkSuggestion) => !x.path.match(REG_LINKINDEX_INVALIDCHARS));
  }

  modifyInput(input: string): string {
    return input;
  }

  getSuggestions(query: string): FuzzyMatch<LinkSuggestion>[] {
    const marker = query.lastIndexOf("[[");
    if (marker === -1) return [];
    const term = query.substring(marker + 2);
    const search = prepareFuzzySearch(term);
    return this.items
      .map((item) => {
        const target = `${item.path}${item.alias ? `|${item.alias}` : ""}`;
        const match = search(target);
        return match ? { item, match } : null;
      })
      .filter(Boolean) as FuzzyMatch<LinkSuggestion>[];
  }

  getItemText(item: LinkSuggestion): string {
    return item.path + (item.alias ? `|${item.alias}` : "");
  }

  onChooseItem(item: LinkSuggestion): void {
    const linkString = this.buildLink(item);
    this.insertLink(linkString);
  }

  renderSuggestion(result: FuzzyMatch<LinkSuggestion>, itemEl: HTMLElement) {
    const { item, match: matches } = result || {};
    itemEl.addClass("mod-complex");
    const contentEl = itemEl.createDiv("suggestion-content");
    const auxEl = itemEl.createDiv("suggestion-aux");
    const titleEl = contentEl.createDiv("suggestion-title");
    const noteEl = contentEl.createDiv("suggestion-note");

    if (!item) {
      titleEl.setText(this.emptyStateText);
      itemEl.addClass("is-selected");
      return;
    }

    const path = item.file?.path ?? item.path;
    const pathLength = path.length - (item.file?.name.length ?? 0);
    const matchElements = matches.matches.map(() =>
      createSpan("suggestion-highlight")
  );
    const itemText = this.getItemText(item);
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
    } else if (this.plugin.isExcalidrawFile(item.file)) {
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
  }

  private buildLink(item: LinkSuggestion): string {
    const sourcePath = this.getSourcePath();
    if (item.file) {
      const linktext = this.app.metadataCache.fileToLinktext(
        item.file,
        sourcePath ?? "",
        true,
      );
      const alias = item.alias ? `|${item.alias}` : "";
      return `[[${linktext}${alias}]]`;
    }
    // unresolved/ghost
    return `[[${item.path}${item.alias ? `|${item.alias}` : ""}]]`;
  }

  private insertLink(link: string) {
    const cursor = this.inputEl.selectionStart ?? this.inputEl.value.length;
    const textBefore = this.inputEl.value.substring(0, cursor);
    const lastIdx = textBefore.lastIndexOf("[[");
    if (lastIdx === -1) {
      return;
    }
    const prefix = this.inputEl.value.substring(0, lastIdx);
    const suffix = this.inputEl.value.substring(cursor);
    this.inputEl.value = prefix + link + suffix;
    this.inputEl.dispatchEvent(new Event("input"));
    const newPos = lastIdx + link.length;
    this.inputEl.setSelectionRange(newPos, newPos);
    this.close();
  }

  // Keep listeners so the suggester can trigger multiple times in the same input session.
  close(): void {
    // match SuggestionModal.close behaviour minus listener removal
    this.app.keymap.popScope(this.scope);
    this.suggester.setSuggestions([]);
    if (this.popper?.deref()) {
      this.popper.deref().destroy();
    }
    this.suggestEl.detach();
    this.shouldNotOpen = false;
  }
}
