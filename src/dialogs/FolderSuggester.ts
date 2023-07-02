import {
  FuzzyMatch,
  TFile,
  BlockCache,
  HeadingCache,
  CachedMetadata,
  TextComponent,
  App,
  TFolder,
  FuzzySuggestModal,
  SuggestModal,
  Scope,
} from "obsidian";
import { t } from "../lang/helpers";
import { createPopper, Instance as PopperInstance } from "@popperjs/core";

class Suggester<T> {
  owner: SuggestModal<T>;
  items: T[];
  suggestions: HTMLDivElement[];
  selectedItem: number;
  containerEl: HTMLElement;
  constructor(owner: SuggestModal<T>, containerEl: HTMLElement, scope: Scope) {
    this.containerEl = containerEl;
    this.owner = owner;
    containerEl.on(
      "click",
      ".suggestion-item",
      this.onSuggestionClick.bind(this),
    );
    containerEl.on(
      "mousemove",
      ".suggestion-item",
      this.onSuggestionMouseover.bind(this),
    );

    scope.register([], "ArrowUp", () => {
      this.setSelectedItem(this.selectedItem - 1, true);
      return false;
    });

    scope.register([], "ArrowDown", () => {
      this.setSelectedItem(this.selectedItem + 1, true);
      return false;
    });

    scope.register([], "Enter", (evt) => {
      this.useSelectedItem(evt);
      return false;
    });

    scope.register([], "Tab", (evt) => {
      this.chooseSuggestion(evt);
      return false;
    });
  }
  chooseSuggestion(evt: KeyboardEvent) {
    if (!this.items || !this.items.length) {
      return;
    }
    const currentValue = this.items[this.selectedItem];
    if (currentValue) {
      this.owner.onChooseSuggestion(currentValue, evt);
    }
  }
  onSuggestionClick(event: MouseEvent, el: HTMLDivElement): void {
    event.preventDefault();
    if (!this.suggestions || !this.suggestions.length) {
      return;
    }

    const item = this.suggestions.indexOf(el);
    this.setSelectedItem(item, false);
    this.useSelectedItem(event);
  }

  onSuggestionMouseover(event: MouseEvent, el: HTMLDivElement): void {
    if (!this.suggestions || !this.suggestions.length) {
      return;
    }
    const item = this.suggestions.indexOf(el);
    this.setSelectedItem(item, false);
  }
  empty() {
    this.containerEl.empty();
  }
  setSuggestions(items: T[]) {
    this.containerEl.empty();
    const els: HTMLDivElement[] = [];

    items.forEach((item) => {
      const suggestionEl = this.containerEl.createDiv("suggestion-item");
      this.owner.renderSuggestion(item, suggestionEl);
      els.push(suggestionEl);
    });
    this.items = items;
    this.suggestions = els;
    this.setSelectedItem(0, false);
  }
  useSelectedItem(event: MouseEvent | KeyboardEvent) {
    if (!this.items || !this.items.length) {
      return;
    }
    const currentValue = this.items[this.selectedItem];
    if (currentValue) {
      this.owner.selectSuggestion(currentValue, event);
    }
  }
  wrap(value: number, size: number): number {
    return ((value % size) + size) % size;
  }
  setSelectedItem(index: number, scroll: boolean) {
    const nIndex = this.wrap(index, this.suggestions.length);
    const prev = this.suggestions[this.selectedItem];
    const next = this.suggestions[nIndex];

    if (prev) {
      prev.removeClass("is-selected");
    }
    if (next) {
      next.addClass("is-selected");
    }

    this.selectedItem = nIndex;

    if (scroll) {
      next.scrollIntoView(false);
    }
  }
}

export abstract class SuggestionModal<T> extends FuzzySuggestModal<T> {
  items: T[] = [];
  suggestions: HTMLDivElement[];
  popper: PopperInstance;
  //@ts-ignore
  scope: Scope = new Scope(this.app.scope);
  suggester: Suggester<FuzzyMatch<T>>;
  suggestEl: HTMLDivElement;
  promptEl: HTMLDivElement;
  emptyStateText: string = "No match found";
  limit: number = 100;
  shouldNotOpen: boolean;
  constructor(app: App, inputEl: HTMLInputElement, items: T[]) {
    super(app);
    this.inputEl = inputEl;
    this.items = items;

    this.suggestEl = createDiv("suggestion-container");

    this.contentEl = this.suggestEl.createDiv("suggestion");

    this.suggester = new Suggester(this, this.contentEl, this.scope);

    this.scope.register([], "Escape", this.onEscape.bind(this));

    this.inputEl.addEventListener("input", this.onInputChanged.bind(this));
    this.inputEl.addEventListener("focus", this.onFocus.bind(this));
    this.inputEl.addEventListener("blur", this.close.bind(this));
    this.suggestEl.on(
      "mousedown",
      ".suggestion-container",
      (event: MouseEvent) => {
        event.preventDefault();
      },
    );
  }
  empty() {
    this.suggester.empty();
  }
  onInputChanged(): void {
    if (this.shouldNotOpen) {
      return;
    }
    const inputStr = this.modifyInput(this.inputEl.value);
    const suggestions = this.getSuggestions(inputStr);
    if (suggestions.length > 0) {
      this.suggester.setSuggestions(suggestions.slice(0, this.limit));
    } else {
      this.onNoSuggestion();
    }
    this.open();
  }
  onFocus(): void {
    this.shouldNotOpen = false;
    this.onInputChanged();
  }
  modifyInput(input: string): string {
    return input;
  }
  onNoSuggestion() {
    this.empty();
    this.renderSuggestion(null, this.contentEl.createDiv("suggestion-item"));
  }
  open(): void {
    // TODO: Figure out a better way to do this. Idea from Periodic Notes plugin
    this.app.keymap.pushScope(this.scope);

    this.inputEl.ownerDocument.body.appendChild(this.suggestEl);
    this.popper = createPopper(this.inputEl, this.suggestEl, {
      placement: "bottom-start",
      modifiers: [
        {
          name: "offset",
          options: {
            offset: [0, 10],
          },
        },
        {
          name: "flip",
          options: {
            fallbackPlacements: ["top"],
          },
        },
      ],
    });
  }

  onEscape(): void {
    this.close();
    this.shouldNotOpen = true;
  }
  close(): void {
    // TODO: Figure out a better way to do this. Idea from Periodic Notes plugin
    this.app.keymap.popScope(this.scope);

    this.suggester.setSuggestions([]);
    if (this.popper) {
      this.popper.destroy();
    }

    this.suggestEl.detach();
  }
  createPrompt(prompts: HTMLSpanElement[]) {
    if (!this.promptEl) {
      this.promptEl = this.suggestEl.createDiv("prompt-instructions");
    }
    const prompt = this.promptEl.createDiv("prompt-instruction");
    for (const p of prompts) {
      prompt.appendChild(p);
    }
  }
  abstract onChooseItem(item: T, evt: MouseEvent | KeyboardEvent): void;
  abstract getItemText(arg: T): string;
  abstract getItems(): T[];
}

export class PathSuggestionModal extends SuggestionModal<
  TFile | BlockCache | HeadingCache
> {
  file: TFile;
  files: TFile[];
  text: TextComponent;
  cache: CachedMetadata;
  constructor(app: App, input: TextComponent, items: TFile[]) {
    super(app, input.inputEl, items);
    this.files = [...items];
    this.text = input;
    //this.getFile();

    this.inputEl.addEventListener("input", this.getFile.bind(this));
  }

  getFile() {
    const v = this.inputEl.value;
    const file = this.app.metadataCache.getFirstLinkpathDest(
      v.split(/[\^#]/).shift() || "",
      "",
    );
    if (file == this.file) {
      return;
    }
    this.file = file;
    if (this.file) {
      this.cache = this.app.metadataCache.getFileCache(this.file);
    }
    this.onInputChanged();
  }
  getItemText(item: TFile | HeadingCache | BlockCache) {
    if (item instanceof TFile) {
      return item.path;
    }
    if (Object.prototype.hasOwnProperty.call(item, "heading")) {
      return (<HeadingCache>item).heading;
    }
    if (Object.prototype.hasOwnProperty.call(item, "id")) {
      return (<BlockCache>item).id;
    }
  }
  onChooseItem(item: TFile | HeadingCache | BlockCache) {
    if (item instanceof TFile) {
      this.text.setValue(item.basename);
      this.file = item;
      this.cache = this.app.metadataCache.getFileCache(this.file);
    } else if (Object.prototype.hasOwnProperty.call(item, "heading")) {
      this.text.setValue(
        `${this.file.basename}#${(<HeadingCache>item).heading}`,
      );
    } else if (Object.prototype.hasOwnProperty.call(item, "id")) {
      this.text.setValue(`${this.file.basename}^${(<BlockCache>item).id}`);
    }
  }
  selectSuggestion({ item }: FuzzyMatch<TFile | BlockCache | HeadingCache>) {
    let link: string;
    if (item instanceof TFile) {
      link = item.basename;
    } else if (Object.prototype.hasOwnProperty.call(item, "heading")) {
      link = `${this.file.basename}#${(<HeadingCache>item).heading}`;
    } else if (Object.prototype.hasOwnProperty.call(item, "id")) {
      link = `${this.file.basename}^${(<BlockCache>item).id}`;
    }

    this.text.setValue(link);
    this.onClose();

    this.close();
  }
  renderSuggestion(
    result: FuzzyMatch<TFile | BlockCache | HeadingCache>,
    el: HTMLElement,
  ) {
    const { item, match: matches } = result || {};
    const content = el.createDiv({
      cls: "suggestion-content",
    });
    if (!item) {
      content.setText(this.emptyStateText);
      content.parentElement.addClass("is-selected");
      return;
    }

    if (item instanceof TFile) {
      const pathLength = item.path.length - item.name.length;
      const matchElements = matches.matches.map((m) => {
        return createSpan("suggestion-highlight");
      });
      for (
        let i = pathLength;
        i < item.path.length - item.extension.length - 1;
        i++
      ) {
        const match = matches.matches.find((m) => m[0] === i);
        if (match) {
          const element = matchElements[matches.matches.indexOf(match)];
          content.appendChild(element);
          element.appendText(item.path.substring(match[0], match[1]));

          i += match[1] - match[0] - 1;
          continue;
        }

        content.appendText(item.path[i]);
      }
      el.createDiv({
        cls: "suggestion-note",
        text: item.path,
      });
    } else if (Object.prototype.hasOwnProperty.call(item, "heading")) {
      content.setText((<HeadingCache>item).heading);
      content.prepend(
        createSpan({
          cls: "suggestion-flair",
          text: `H${(<HeadingCache>item).level}`,
        }),
      );
    } else if (Object.prototype.hasOwnProperty.call(item, "id")) {
      content.setText((<BlockCache>item).id);
    }
  }
  get headings() {
    if (!this.file) {
      return [];
    }
    if (!this.cache) {
      this.cache = this.app.metadataCache.getFileCache(this.file);
    }
    return this.cache.headings || [];
  }
  get blocks() {
    if (!this.file) {
      return [];
    }
    if (!this.cache) {
      this.cache = this.app.metadataCache.getFileCache(this.file);
    }
    return Object.values(this.cache.blocks || {}) || [];
  }
  getItems() {
    const v = this.inputEl.value;
    if (/#/.test(v)) {
      this.modifyInput = (i) => i.split(/#/).pop();
      return this.headings;
    } else if (/\^/.test(v)) {
      this.modifyInput = (i) => i.split(/\^/).pop();
      return this.blocks;
    }
    return this.files;
  }
}

export class FolderSuggestionModal extends SuggestionModal<TFolder> {
  text: TextComponent;
  cache: CachedMetadata;
  folders: TFolder[];
  folder: TFolder;
  constructor(app: App, input: TextComponent, items: TFolder[]) {
    super(app, input.inputEl, items);
    this.folders = [...items];
    this.text = input;

    this.inputEl.addEventListener("input", () => this.getFolder());
  }
  getFolder() {
    const v = this.inputEl.value;
    const folder = this.app.vault.getAbstractFileByPath(v);
    if (folder == this.folder) {
      return;
    }
    if (!(folder instanceof TFolder)) {
      return;
    }
    this.folder = folder;

    this.onInputChanged();
  }
  getItemText(item: TFolder) {
    return item.path;
  }
  onChooseItem(item: TFolder) {
    this.text.setValue(item.path);
    this.folder = item;
  }
  selectSuggestion({ item }: FuzzyMatch<TFolder>) {
    const link = item.path;

    this.text.setValue(link);
    this.onClose();

    this.close();
  }
  renderSuggestion(result: FuzzyMatch<TFolder>, el: HTMLElement) {
    const { item, match: matches } = result || {};
    const content = el.createDiv({
      cls: "suggestion-content",
    });
    if (!item) {
      content.setText(this.emptyStateText);
      content.parentElement.addClass("is-selected");
      return;
    }

    const pathLength = item.path.length - item.name.length;
    const matchElements = matches.matches.map((m) => {
      return createSpan("suggestion-highlight");
    });
    for (let i = pathLength; i < item.path.length; i++) {
      const match = matches.matches.find((m) => m[0] === i);
      if (match) {
        const element = matchElements[matches.matches.indexOf(match)];
        content.appendChild(element);
        element.appendText(item.path.substring(match[0], match[1]));

        i += match[1] - match[0] - 1;
        continue;
      }

      content.appendText(item.path[i]);
    }
    el.createDiv({
      cls: "suggestion-note",
      text: item.path,
    });
  }

  getItems() {
    return this.folders;
  }
}

export class FileSuggestionModal extends SuggestionModal<TFile> {
  text: TextComponent;
  cache: CachedMetadata;
  files: TFile[];
  file: TFile;
  constructor(app: App, input: TextComponent, items: TFile[]) {
    super(app, input.inputEl, items);
    this.limit = 20;
    this.files = [...items];
    this.text = input;
    this.inputEl.addEventListener("input", () => this.getFile());
  }

  getFile() {
    const v = this.inputEl.value;
    const file = this.app.vault.getAbstractFileByPath(v);
    if (file === this.file) {
      return;
    }
    if (!(file instanceof TFile)) {
      return;
    }
    this.file = file;

    this.onInputChanged();
  }

  getSelectedItem() {
    return this.file;
  }

  getItemText(item: TFile) {
    return item.path;
  }

  onChooseItem(item: TFile) {
    this.file = item;
    this.text.setValue(item.path);
    this.text.onChanged();
  }

  selectSuggestion({ item }: FuzzyMatch<TFile>) {
    this.file = item;
    this.text.setValue(item.path);
    this.onClose();
    this.text.onChanged();
    this.close();
  }
  
  renderSuggestion(result: FuzzyMatch<TFile>, el: HTMLElement) {
    const { item, match: matches } = result || {};
    const content = el.createDiv({
      cls: "suggestion-content",
    });
    if (!item) {
      content.setText(this.emptyStateText);
      content.parentElement.addClass("is-selected");
      return;
    }

    const pathLength = item.path.length - item.name.length;
    const matchElements = matches.matches.map((m) => {
      return createSpan("suggestion-highlight");
    });
    for (let i = pathLength; i < item.path.length; i++) {
      const match = matches.matches.find((m) => m[0] === i);
      if (match) {
        const element = matchElements[matches.matches.indexOf(match)];
        content.appendChild(element);
        element.appendText(item.path.substring(match[0], match[1]));

        i += match[1] - match[0] - 1;
        continue;
      }

      content.appendText(item.path[i]);
    }
    el.createDiv({
      cls: "suggestion-note",
      text: item.path,
    });
  }

  getItems() {
    return this.files;
  }
}