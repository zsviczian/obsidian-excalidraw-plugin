import { App, FuzzyMatch, TFile } from "obsidian";
import { SuggestionModal } from "./SuggestionModal";
import { LinkSuggestion } from "src/types/types";
import ExcalidrawPlugin from "src/core/main";
import {
  getLinkSuggestionsFiltered,
  getSortedLinkMatches,
  renderHeadingSuggestionRow,
  renderLinkSuggestion,
  renderParagraphSuggestionRow,
  fuzzyMatchTextItems,
  fuzzyMatchParagraphsWithId,
} from "src/shared/Suggesters/LinkSuggesterUtils";
import { KeyBlocker } from "src/types/excalidrawAutomateTypes";
import { t } from "src/lang/helpers";
import { nanoid } from "src/constants/constants";
import { sleep } from "src/utils/utils";

type HeadingSuggestion = {
  kind: "heading";
  heading: string;
  level: number;
  anchor: string;
  file: TFile;
};

type ParagraphSuggestion = {
  kind: "paragraph";
  text: string;
  id?: string;
  file: TFile;
  node: any;
};

type InlineSuggestion = LinkSuggestion | HeadingSuggestion | ParagraphSuggestion;

/**
 * Inline link suggester that attaches to a specific input element.
 */
export class InlineLinkSuggester extends SuggestionModal<InlineSuggestion> implements KeyBlocker {
  private readonly getSourcePath: () => string | undefined;
  private readonly plugin: ExcalidrawPlugin;
  private readonly widthHost: HTMLElement;
  private readonly hasCustomWidthHost: boolean;
  private readonly handleBracketKeyDown: (event: KeyboardEvent) => void;
  private block = false;
  private activeOpen = -1;
  private activeClose = -1;
  private caretPos = 0;
  private activeAlias: string | null = null;
  private activeSearchTerm = "";
  private activeFile: TFile | null = null;
  private mode: "file" | "heading" | "block" | null = null;
  private headingItems: HeadingSuggestion[] = [];
  private paragraphItems: ParagraphSuggestion[] = [];

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
    this.handleBracketKeyDown = (event: KeyboardEvent) => this.onBracketKeyDown(event);
    this.limit = 20;
    if (!surpessPlaceholder) {
      this.setPlaceholder(t("INLINE_HINT"));
    }
    this.emptyStateText = "No match";
    this.syncWidth();
    this.inputEl.addEventListener("keydown", this.handleBracketKeyDown);
  }

  public isBlockingKeys() {
    return this.block;
  }

  private onBracketKeyDown(event: KeyboardEvent) {
    if (event.key !== "[" || event.metaKey || event.ctrlKey || event.defaultPrevented || event.isComposing) {
      return;
    }

    const selectionStart = this.inputEl.selectionStart;
    const selectionEnd = this.inputEl.selectionEnd;
    if (selectionStart === null || selectionEnd === null) {
      return;
    }

    const hasSelection = selectionStart !== selectionEnd;
    const value = this.inputEl.value;
    const before = value.substring(0, selectionStart);
    const selected = value.substring(selectionStart, selectionEnd);
    const after = value.substring(selectionEnd);

    event.preventDefault();

    const insertion = hasSelection ? `[${selected}]` : "[]";
    const cursorPos = selectionStart + 1 + (hasSelection ? selected.length : 0);
    this.inputEl.value = `${before}${insertion}${after}`;
    this.inputEl.setSelectionRange(cursorPos, cursorPos);
    this.dispatchInputChange();
  }

  getItems(): InlineSuggestion[] {
    return getLinkSuggestionsFiltered(this.app) as InlineSuggestion[];
  }

  /**
   * Keep the suggestion dropdown aligned to the provided width host (input or wrapper).
   */
  private syncWidth() {
    const hostRect = this.widthHost?.getBoundingClientRect();
    const width = hostRect?.width ?? this.widthHost?.clientWidth;

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
    
    if (!this.hasCustomWidthHost) {
      availableWidth = minWidth <= 450
        ? Math.min(availableWidth, 450)
        : Math.min(availableWidth, minWidth);
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
    this.items = getLinkSuggestionsFiltered(this.app) as InlineSuggestion[];
  }

  modifyInput(input: string): string {
    return input;
  }

  async onInputChanged(): Promise<void> {
    const inputStr = this.modifyInput(this.inputEl.value);
    this.caretPos = this.inputEl.selectionStart ?? inputStr.length;

    if ((this.inputEl.selectionEnd ?? this.caretPos) - (this.inputEl.selectionStart ?? 0) > 0) {
      this.resetSuggestions();
      return;
    }

    const active = this.findActiveLink(inputStr, this.caretPos);
    if (!active) {
      this.resetSuggestions();
      return;
    }

    this.activeOpen = active.open;
    this.activeClose = active.close;

    const context = this.parseLinkContext(inputStr, this.caretPos, active.open, active.close);
    this.activeAlias = context.alias;
    this.activeSearchTerm = context.searchTerm;
    this.activeFile = context.file;
    this.mode = context.mode;

    if (context.inAlias) {
      this.resetSuggestions();
      return;
    }

    if (this.mode === "heading") {
      await this.loadHeadings(this.activeFile);
    } else if (this.mode === "block") {
      await this.loadParagraphs(this.activeFile);
    } else {
      this.headingItems = [];
      this.paragraphItems = [];
    }

    this.block = true;
    await super.onInputChanged();
  }

  getSuggestions(query: string): FuzzyMatch<InlineSuggestion>[] {
    if (this.activeOpen === -1) return [];

    if (this.mode === "heading") {
      return fuzzyMatchTextItems(this.activeSearchTerm ?? "", this.headingItems, (h) => h.heading);
    }

    if (this.mode === "block") {
      return fuzzyMatchParagraphsWithId(this.activeSearchTerm ?? "", this.paragraphItems);
    }

    const term = this.activeSearchTerm ?? "";
    return getSortedLinkMatches(term, this.items as LinkSuggestion[]);
  }

  private isHeading(item: InlineSuggestion): item is HeadingSuggestion {
    return (item as HeadingSuggestion)?.kind === "heading";
  }

  private isParagraph(item: InlineSuggestion): item is ParagraphSuggestion {
    return (item as ParagraphSuggestion)?.kind === "paragraph";
  }

  getItemText(item: InlineSuggestion): string {
    if (this.isHeading(item)) {
      return item.heading;
    }
    if (this.isParagraph(item)) {
      return item.text;
    }
    return (item as LinkSuggestion).path + ((item as LinkSuggestion).alias ? `|${(item as LinkSuggestion).alias}` : "");
  }

  async onChooseItem(item: InlineSuggestion | undefined): Promise<void> {
    if (!item) return;

    if (this.isHeading(item)) {
      const linktext = this.app.metadataCache.fileToLinktext(
        item.file,
        this.getSourcePath() ?? "",
        true,
      );
      const aliasSuffix = this.activeAlias !== null ? `|${this.activeAlias}` : "";
      this.insertLink(`[[${linktext}#${item.anchor}${aliasSuffix}]]`);
      return;
    }

    if (this.isParagraph(item)) {
      const id = await this.ensureParagraphHasId(item);
      if (!id) return;
      const linktext = this.app.metadataCache.fileToLinktext(
        item.file,
        this.getSourcePath() ?? "",
        true,
      );
      const aliasSuffix = this.activeAlias !== null ? `|${this.activeAlias}` : "";
      this.insertLink(`[[${linktext}#^${id}${aliasSuffix}]]`);
      return;
    }

    const linkString = this.buildLink(item as LinkSuggestion);
    this.insertLink(linkString);
  }

  async selectSuggestion(value: FuzzyMatch<InlineSuggestion>, evt: MouseEvent | KeyboardEvent) {
    evt?.preventDefault?.();
    evt?.stopPropagation?.();
    await this.onChooseItem(value?.item);
  }

  open(): void {
    this.block = true;
    this.syncWidth();
    this.suggestEl.style.pointerEvents = "all";
    super.open();
  }

  renderSuggestion(result: FuzzyMatch<InlineSuggestion>, itemEl: HTMLElement) {
    const { item } = result || {};

    if (this.isHeading(item as InlineSuggestion)) {
      const note = item
        ? this.app.metadataCache.fileToLinktext((item as HeadingSuggestion).file, this.getSourcePath() ?? "", true)
        : "";
      renderHeadingSuggestionRow(result as FuzzyMatch<HeadingSuggestion>, note, itemEl);
      return;
    }

    if (this.isParagraph(item as InlineSuggestion)) {
      const note = item
        ? this.app.metadataCache.fileToLinktext((item as ParagraphSuggestion).file, this.getSourcePath() ?? "", true)
        : "";
      renderParagraphSuggestionRow(result as FuzzyMatch<ParagraphSuggestion>, note, itemEl);
      return;
    }

    renderLinkSuggestion(this.plugin, result as FuzzyMatch<LinkSuggestion>, itemEl, this.emptyStateText);
  }

  private buildLink(item: LinkSuggestion): string {
    const sourcePath = this.getSourcePath();
    const aliasFromContext = this.activeAlias;
    const aliasSuffix = aliasFromContext !== null
      ? `|${aliasFromContext}`
      : item.alias
        ? `|${item.alias}`
        : "";
    if (item.file) {
      const linktext = this.app.metadataCache.fileToLinktext(
        item.file,
        sourcePath ?? "",
        true,
      );
      return `[[${linktext}${aliasSuffix}]]`;
    }
    // unresolved/ghost
    return `[[${item.path}${aliasSuffix}]]`;
  }

  private insertLink(link: string) {
    const cursor = this.inputEl.selectionStart ?? this.inputEl.value.length;
    const start = this.activeOpen >= 0 ? this.activeOpen : this.inputEl.value.lastIndexOf("[[", cursor);
    if (start === -1) {
      return;
    }

    const nextOpen = this.inputEl.value.indexOf("[[", start + 2);
    const fallbackClose = this.inputEl.value.indexOf("]]", start + 2);
    const closeBelongsToLink = this.activeClose >= 0
      ? true
      : fallbackClose !== -1 && (nextOpen === -1 || fallbackClose < nextOpen);
    const effectiveClose = this.activeClose >= 0 ? this.activeClose : closeBelongsToLink ? fallbackClose : -1;
    // If no valid closing brackets are present for this link (e.g. another [[ appears first),
    // only replace up to the current cursor to avoid swallowing subsequent text.
    const end = effectiveClose >= 0 ? effectiveClose + 2 : cursor;

    const prefix = this.inputEl.value.substring(0, start);
    const suffix = this.inputEl.value.substring(end);
    this.inputEl.value = prefix + link + suffix;
    this.dispatchInputChange();
    const newPos = start + link.length;
    this.inputEl.setSelectionRange(newPos, newPos);
    this.close();
  }

  private resetSuggestions() {
    this.suggester.setSuggestions([]);
    if (this.popper?.deref()) {
      this.popper.deref().destroy();
    }
    this.suggestEl.detach();
    this.activeOpen = -1;
    this.activeClose = -1;
    this.activeAlias = null;
    this.activeSearchTerm = "";
    this.activeFile = null;
    this.mode = null;
    this.headingItems = [];
    this.paragraphItems = [];
    setTimeout(() => {
      this.block = false;
    });
  }

  private parseLinkContext(value: string, caret: number, open: number, close: number) {
    const activeInfo = this.extractActiveInfo(value, caret, open, close);
    const closeIndex = close >= 0 ? close : value.length;
    const linkText = value.substring(open + 2, closeIndex);
    const pipeIndex = linkText.indexOf("|");
    const linkWithoutAlias = pipeIndex >= 0 ? linkText.substring(0, pipeIndex) : linkText;
    const hashIndex = linkWithoutAlias.indexOf("#");
    const caretInLink = Math.max(0, Math.min(caret - (open + 2), linkText.length));
    const inSubpath = hashIndex >= 0 && caretInLink > hashIndex;
    const isBlockMode = inSubpath && linkWithoutAlias.charAt(hashIndex + 1) === "^";
    const basePath = hashIndex >= 0 ? linkWithoutAlias.substring(0, hashIndex) : linkWithoutAlias;
    const subpathTerm = inSubpath
      ? linkWithoutAlias.substring(hashIndex + (isBlockMode ? 2 : 1), caretInLink)
      : "";
    const file = basePath
      ? this.app.metadataCache.getFirstLinkpathDest(basePath, this.getSourcePath() ?? "")
      : null;

    const mode = file && file.extension === "md" && inSubpath ? (isBlockMode ? "block" : "heading") : "file";
    const searchTerm = mode === "file" ? activeInfo.searchTerm : subpathTerm;

    return {
      alias: activeInfo.alias,
      inAlias: activeInfo.inAlias,
      searchTerm,
      file: mode === "file" ? null : file,
      mode,
    } as const;
  }

  private async loadHeadings(file: TFile | null) {
    if (!file || file.extension !== "md") {
      this.headingItems = [];
      return;
    }

    const cache = await this.app.metadataCache.blockCache.getForFile({ isCancelled: () => false }, file);
    const blocks = cache?.blocks ?? [];
    this.headingItems = blocks
      .filter((b: any) => b.display && b.node?.type === "heading")
      .map((b: any) => ({
        kind: "heading",
        heading: this.cleanHeading(b.display),
        anchor: this.cleanHeading(b.display),
        level: b.node?.depth ?? b.node?.level ?? 1,
        file,
      }));
  }

  private async loadParagraphs(file: TFile | null) {
    if (!file || file.extension !== "md") {
      this.paragraphItems = [];
      return;
    }

    const cache = await this.app.metadataCache.blockCache.getForFile({ isCancelled: () => false }, file);
    const blocks = cache?.blocks ?? [];
    this.paragraphItems = blocks
      .filter((b: any) =>
        b.display &&
        b.node &&
        (b.node.type === "paragraph" ||
          b.node.type === "blockquote" ||
          b.node.type === "listItem" ||
          b.node.type === "table" ||
          b.node.type === "callout"),
      )
      .map((b: any) => ({
        kind: "paragraph",
        text: b.display.trim(),
        id: b.node?.id,
        node: b.node,
        file,
      }));
  }

  private cleanHeading(display: string): string {
    return display.replace(/^#+\s*/, "").trim();
  }

  private async ensureParagraphHasId(item: ParagraphSuggestion): Promise<string | null> {
    if (item.id) return item.id;
    const offset = item.node?.position?.end?.offset;
    if (!offset) return null;
    const fileContents = await this.plugin.app.vault.cachedRead(item.file);
    const newId = nanoid();
    await this.plugin.app.vault.modify(
      item.file,
      `${fileContents.slice(0, offset)} ^${newId}${fileContents.slice(offset)}`,
    );
    await sleep(200);
    item.id = newId;
    return newId;
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
      const nextOpen = value.indexOf("[[", open + 2);
      const closeCandidate = value.indexOf("]]", open + 2);
      const closeBelongsToLink = closeCandidate !== -1 && (nextOpen === -1 || closeCandidate < nextOpen);
      const close = closeBelongsToLink ? closeCandidate : -1;
      const caretInsideBrackets = pos > open + 1 && (close === -1 || pos <= close);
      if (caretInsideBrackets) {
        candidate = { open, close };
        break;
      }
      if (close !== -1) {
        searchFrom = close + 2;
      } else if (nextOpen !== -1) {
        searchFrom = nextOpen + 2;
      } else {
        break;
      }
    }
    return candidate;
  }

  private extractActiveInfo(value: string, caret: number, open: number, close: number): {alias: string | null; inAlias: boolean; searchTerm: string} {
    const closeIndex = close >= 0 ? close : value.length;
    const linkText = value.substring(open + 2, closeIndex);
    const caretInLink = Math.max(0, Math.min(caret - (open + 2), linkText.length));
    const pipeIndex = linkText.indexOf("|");
    const alias = pipeIndex >= 0 ? linkText.substring(pipeIndex + 1) : null;
    const inAlias = pipeIndex >= 0 && caretInLink > pipeIndex;

    const linkPart = pipeIndex >= 0 ? linkText.substring(0, pipeIndex) : linkText;
    const caretInLinkPart = Math.min(caretInLink, linkPart.length);
    const rawTerm = linkPart.substring(0, caretInLinkPart);
    const searchTerm = rawTerm.replace(/^.*[\\/]/, "");

    return { alias, inAlias, searchTerm };
  }

  private dispatchInputChange() {
    const eventInit = { bubbles: true, composed: true, cancelable: true };
    const inputEvt = typeof InputEvent !== "undefined"
      ? new InputEvent("input", eventInit as InputEventInit)
      : new Event("input", eventInit);
    this.inputEl.dispatchEvent(inputEvt);
    const changeEvt = new Event("change", eventInit);
    this.inputEl.dispatchEvent(changeEvt);
  }
}
