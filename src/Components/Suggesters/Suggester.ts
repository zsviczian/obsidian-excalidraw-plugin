import {
  SuggestModal,
  Scope,
} from "obsidian";

export class Suggester<T> {
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
