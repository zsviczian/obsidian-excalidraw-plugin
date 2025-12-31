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
  
  // Pre-bound event handlers
  private handleInput: () => void;
  private handleFocus: () => void;
  private handleBlur: () => void;
  private handleMouseDown: (event: MouseEvent) => void;
  public readonly collisionBoundary?: HTMLElement;
  
  constructor(app: App, inputEl: HTMLInputElement | HTMLTextAreaElement, items: T[], collisionBoundary?: HTMLElement) {
    super(app);
    this.inputEl = inputEl as HTMLInputElement;
    this.items = items;
    this.collisionBoundary = collisionBoundary;
    
    // Pre-bind event handlers
    this.handleInput = this.onInputChanged.bind(this);
    this.handleFocus = this.onFocus.bind(this);
    this.handleBlur = this.close.bind(this);
    this.handleMouseDown = (event: MouseEvent) => {
      event.preventDefault();
    };
    
    this.suggestEl = createDiv("suggestion-container");
    this.contentEl = this.suggestEl.createDiv("suggestion");
    this.suggester = new Suggester(this, this.contentEl, this.scope);
    this.scope.register([], "Escape", this.onEscape.bind(this));
    this.inputEl.addEventListener("input", this.handleInput);
    this.inputEl.addEventListener("focus", this.handleFocus);
    this.inputEl.addEventListener("blur", this.handleBlur);
    this.suggestEl.on("mousedown", ".suggestion-container", this.handleMouseDown);
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
    //setTimeout(() => {
      const modal = this.inputEl.closest(".modal");
      const modalContainer =
        (this.inputEl.closest(".modal-container") as HTMLElement) ??
        (modal?.parentElement?.matches(".modal-container")
          ? (modal.parentElement as HTMLElement)
          : null);

      const host = modalContainer ?? this.inputEl.ownerDocument.body;

      host.appendChild(this.suggestEl);

      const boundary = this.collisionBoundary ?? host;

      this.popper = new WeakRef(createPopper(this.inputEl, this.suggestEl, {
        placement: "bottom-start",
        strategy: host.matches(".modal-container") ? "absolute" : "fixed",
        modifiers: [
          { name: "offset", options: { offset: [0, 10] } },
          { name: "flip", options: { fallbackPlacements: ["top"] } },
          { name: 
            "preventOverflow",
            options: {
              boundary,
              altBoundary: true,
              padding: { left: 8, right: 8 },
            }
          },
        ],
      }));
    //},50);
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
    this.inputEl.removeEventListener("input", this.handleInput);
    this.inputEl.removeEventListener("focus", this.handleFocus);
    this.inputEl.removeEventListener("blur", this.handleBlur);
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