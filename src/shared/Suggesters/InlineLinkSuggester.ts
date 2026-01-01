import { App, FuzzyMatch } from "obsidian";
import { SuggestionModal } from "./SuggestionModal";
import { LinkSuggestion } from "src/types/types";
import ExcalidrawPlugin from "src/core/main";
import { getLinkSuggestionsFiltered, getSortedLinkMatches, renderLinkSuggestion } from "src/shared/Suggesters/LinkSuggesterUtils";
import { KeyBlocker } from "src/types/excalidrawAutomateTypes";

/**
 * Inline link suggester that attaches to a specific input element.
 */
export class InlineLinkSuggester extends SuggestionModal<LinkSuggestion> implements KeyBlocker {
  private readonly getSourcePath: () => string | undefined;
  private readonly plugin: ExcalidrawPlugin;
  private readonly widthHost: HTMLElement;
  private readonly hasCustomWidthHost: boolean;
  private block = false;
  private activeOpen = -1;
  private activeClose = -1;
  private caretPos = 0;

  constructor(
    app: App,
    plugin: ExcalidrawPlugin,
    inputEl: HTMLInputElement | HTMLTextAreaElement,
    getSourcePath: () => string | undefined,
    widthWrapper?: HTMLElement,
    surpessPlaceholder: boolean = false,
    collisionBoundary?: HTMLElement,
  ) {
    const items = getLinkSuggestionsFiltered(app);
    super(app, inputEl, items, collisionBoundary);
    this.plugin = plugin;
    this.getSourcePath = getSourcePath;
    this.widthHost = widthWrapper ?? inputEl;
    this.hasCustomWidthHost = Boolean(widthWrapper);
    this.limit = 20;
    if (!surpessPlaceholder) {
      this.setPlaceholder("Start typing [[ to link...");
    } else {
      this.setPlaceholder("");
    }
    this.emptyStateText = "No match";
    this.syncWidth();
  }

  public isBlockingKeys() {
    return this.block;
  }

  getItems(): LinkSuggestion[] {
    return getLinkSuggestionsFiltered(this.app);
  }

  /**
   * Keep the suggestion dropdown aligned to the provided width host (input or wrapper).
   */
  private syncWidth() {
    const hostRect = this.widthHost?.getBoundingClientRect();
    const width = this.widthHost?.clientWidth || hostRect?.width;

    if (width && this.hasCustomWidthHost) {
      this.suggestEl.style.width = `${width}px`;
      this.suggestEl.style.maxWidth = `${width}px`;
      this.suggestEl.style.minWidth = `${width}px`;
      return;
    }

    const minWidth = Math.max(width || this.inputEl.clientWidth || this.inputEl.getBoundingClientRect().width, 450);
    if (!minWidth) {
      return;
    }

    const anchorRect = hostRect ?? this.inputEl.getBoundingClientRect();
    let availableWidth = this.collisionBoundary
      ? this.collisionBoundary.innerWidth - 16 //SuggestionModal padding
      : Math.max(0, window.innerWidth - anchorRect.left - 16);
    
    if (!this.hasCustomWidthHost && minWidth <= 450) {
      availableWidth = Math.min(availableWidth, 450);
    }
    
    const clampedMinWidth = Math.min(minWidth, availableWidth);

    this.suggestEl.style.width = "";
    this.suggestEl.style.minWidth = `${clampedMinWidth}px`;
    this.suggestEl.style.maxWidth = `${availableWidth}px`;
  }

  /**
   * Refreshes the suggestion data (e.g. when vault changes) without recreating the instance.
   */
  public refreshItems() {
    this.items = getLinkSuggestionsFiltered(this.app);
  }

  modifyInput(input: string): string {
    return input;
  }

  onInputChanged(): void {
    const inputStr = this.modifyInput(this.inputEl.value);
    this.caretPos = this.inputEl.selectionStart ?? inputStr.length;

    // Do not show suggestions while a range is selected.
    if ((this.inputEl.selectionEnd ?? this.caretPos) - (this.inputEl.selectionStart ?? 0) > 0) {
      this.suggester.setSuggestions([]);
      if (this.popper?.deref()) {
        this.popper.deref().destroy();
      }
      this.suggestEl.detach();
      this.activeOpen = -1;
      this.activeClose = -1;
      setTimeout(() => {
        this.block = false;
      });
      return;
    }

    const active = this.findActiveLink(inputStr, this.caretPos);
    if (!active) {
      this.suggester.setSuggestions([]);
      if (this.popper?.deref()) {
        this.popper.deref().destroy();
      }
      this.suggestEl.detach();
      this.activeOpen = -1;
      this.activeClose = -1;
      setTimeout(() => {
        this.block = false;
      });
      return;
    }
    this.activeOpen = active.open;
    this.activeClose = active.close;
    this.block = true;
    super.onInputChanged();
  }

  getSuggestions(query: string): FuzzyMatch<LinkSuggestion>[] {
    if (this.activeOpen === -1) return [];
    const termEnd = this.caretPos ?? query.length;
    const term = query.substring(this.activeOpen + 2, termEnd);
    return getSortedLinkMatches(term, this.items);
  }

  getItemText(item: LinkSuggestion): string {
    return item.path + (item.alias ? `|${item.alias}` : "");
  }

  onChooseItem(item: LinkSuggestion): void {
    const linkString = this.buildLink(item);
    this.insertLink(linkString);
  }

  selectSuggestion(value: FuzzyMatch<LinkSuggestion>, evt: MouseEvent | KeyboardEvent) {
    evt?.preventDefault?.();
    evt?.stopPropagation?.();
    this.onChooseItem(value?.item);
  }

  open(): void {
    this.block = true;
    this.syncWidth();
    this.suggestEl.style.pointerEvents = "all";
    super.open();
  }

  renderSuggestion(result: FuzzyMatch<LinkSuggestion>, itemEl: HTMLElement) {
    renderLinkSuggestion(this.plugin, result, itemEl, this.emptyStateText);
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
    this.app.keymap.popScope(this.scope);
    this.suggester.setSuggestions([]);
    if (this.popper?.deref()) {
      this.popper.deref().destroy();
    }
    this.suggestEl.detach();
    this.shouldNotOpen = false;
    setTimeout(() => {
      this.block = false;
    });
  }

  onEscape(): void {
    this.close();
    this.shouldNotOpen = false;
  }

  private findActiveLink(value: string, pos: number): {open: number; close: number} | null {
    let searchFrom = 0;
    let candidate: {open: number; close: number} | null = null;
    while (true) {
      const open = value.indexOf("[[", searchFrom);
      if (open === -1 || open > pos) break;
      const close = value.indexOf("]]", open + 2);
      if (close === -1 || pos <= close) {
        candidate = { open, close };
        break;
      }
      searchFrom = close + 2;
    }
    return candidate;
  }
}
