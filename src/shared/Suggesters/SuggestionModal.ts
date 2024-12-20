import {
  FuzzyMatch,
  App,
  FuzzySuggestModal,
  Scope,
} from "obsidian";
import { createPopper, Instance as PopperInstance } from "@popperjs/core";
import { Suggester } from "./Suggester";

export abstract class SuggestionModal<T> extends FuzzySuggestModal<T> {
  items: T[] = [];
  suggestions: HTMLDivElement[];
  popper: WeakRef<PopperInstance>;
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
    this.popper = new WeakRef(createPopper(this.inputEl, this.suggestEl, {
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
    }));
  }

  onEscape(): void {
    this.close();
    this.shouldNotOpen = true;
  }

  close(): void {
    // TODO: Figure out a better way to do this. Idea from Periodic Notes plugin
    this.app.keymap.popScope(this.scope);
    this.suggester.setSuggestions([]);
    if (this.popper?.deref()) {
      this.popper.deref().destroy();
    }
    this.inputEl.removeEventListener("input", this.onInputChanged.bind(this));
    this.inputEl.removeEventListener("focus", this.onFocus.bind(this));
    this.inputEl.removeEventListener("blur", this.close.bind(this));
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