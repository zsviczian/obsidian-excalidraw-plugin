import {
  App,
  ButtonComponent,
  Modal,
  TextComponent,
  FuzzyMatch,
  FuzzySuggestModal,
} from "obsidian";

export class Prompt extends Modal {
  private promptEl: HTMLInputElement;
  private resolve: (value: string) => void;

  constructor(
    app: App,
    private prompt_text: string,
    private default_value?: string,
    private placeholder?: string,
    private prompt_desc?: string,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(this.prompt_text);
    this.createForm();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  createForm(): void {
    let div = this.contentEl.createDiv();
    div.addClass("excalidraw-prompt-div");
    if (this.prompt_desc) {
      div = div.createDiv();
      div.style.width = "100%";
      const p = div.createEl("p");
      p.innerHTML = this.prompt_desc;
    }
    const form = div.createEl("form");
    form.addClass("excalidraw-prompt-form");
    form.type = "submit";
    form.onsubmit = (e: Event) => {
      e.preventDefault();
      this.resolve(this.promptEl.value);
      this.close();
    };

    this.promptEl = form.createEl("input");
    this.promptEl.type = "text";
    this.promptEl.placeholder = this.placeholder;
    this.promptEl.value = this.default_value ?? "";
    this.promptEl.addClass("excalidraw-prompt-input");
    this.promptEl.select();
  }

  async openAndGetValue(resolve: (value: string) => void): Promise<void> {
    this.resolve = resolve;
    this.open();
  }
}

export class GenericInputPrompt extends Modal {
  public waitForClose: Promise<string>;

  private resolvePromise: (input: string) => void;
  private rejectPromise: (reason?: any) => void;
  private didSubmit: boolean = false;
  private inputComponent: TextComponent;
  private input: string;
  private readonly placeholder: string;

  public static Prompt(
    app: App,
    header: string,
    placeholder?: string,
    value?: string,
  ): Promise<string> {
    const newPromptModal = new GenericInputPrompt(
      app,
      header,
      placeholder,
      value,
    );
    return newPromptModal.waitForClose;
  }

  protected constructor(
    app: App,
    private header: string,
    placeholder?: string,
    value?: string,
  ) {
    super(app);
    this.placeholder = placeholder;
    this.input = value;

    this.waitForClose = new Promise<string>((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
    });

    this.display();
    this.open();
  }

  private display() {
    this.contentEl.empty();
    this.titleEl.textContent = this.header;

    const mainContentContainer: HTMLDivElement = this.contentEl.createDiv();
    this.inputComponent = this.createInputField(
      mainContentContainer,
      this.placeholder,
      this.input,
    );
    this.createButtonBar(mainContentContainer);
  }

  protected createInputField(
    container: HTMLElement,
    placeholder?: string,
    value?: string,
  ) {
    const textComponent = new TextComponent(container);

    textComponent.inputEl.style.width = "100%";
    textComponent
      .setPlaceholder(placeholder ?? "")
      .setValue(value ?? "")
      .onChange((value) => (this.input = value))
      .inputEl.addEventListener("keydown", this.submitEnterCallback);

    return textComponent;
  }

  private createButton(
    container: HTMLElement,
    text: string,
    callback: (evt: MouseEvent) => any,
  ) {
    const btn = new ButtonComponent(container);
    btn.setButtonText(text).onClick(callback);

    return btn;
  }

  private createButtonBar(mainContentContainer: HTMLDivElement) {
    const buttonBarContainer: HTMLDivElement = mainContentContainer.createDiv();
    this.createButton(
      buttonBarContainer,
      "Ok",
      this.submitClickCallback,
    ).setCta().buttonEl.style.marginRight = "0";
    this.createButton(buttonBarContainer, "Cancel", this.cancelClickCallback);

    buttonBarContainer.style.display = "flex";
    buttonBarContainer.style.flexDirection = "row-reverse";
    buttonBarContainer.style.justifyContent = "flex-start";
    buttonBarContainer.style.marginTop = "1rem";
  }

  private submitClickCallback = () => this.submit();
  private cancelClickCallback = () => this.cancel();

  private submitEnterCallback = (evt: KeyboardEvent) => {
    if (evt.key === "Enter") {
      evt.preventDefault();
      this.submit();
    }
  };

  private submit() {
    this.didSubmit = true;

    this.close();
  }

  private cancel() {
    this.close();
  }

  private resolveInput() {
    if (!this.didSubmit) {
      this.rejectPromise("No input given.");
    } else {
      this.resolvePromise(this.input);
    }
  }

  private removeInputListener() {
    this.inputComponent.inputEl.removeEventListener(
      "keydown",
      this.submitEnterCallback,
    );
  }

  onOpen() {
    super.onOpen();

    this.inputComponent.inputEl.focus();
    this.inputComponent.inputEl.select();
  }

  onClose() {
    super.onClose();
    this.resolveInput();
    this.removeInputListener();
  }
}

export class GenericSuggester extends FuzzySuggestModal<string> {
  private resolvePromise: (value: string) => void;
  private rejectPromise: (reason?: any) => void;
  public promise: Promise<string>;
  private resolved: boolean;

  public static Suggest(app: App, displayItems: string[], items: string[]) {
    const newSuggester = new GenericSuggester(app, displayItems, items);
    return newSuggester.promise;
  }

  public constructor(
    app: App,
    private displayItems: string[],
    private items: string[],
  ) {
    super(app);

    this.promise = new Promise<string>((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
    });

    this.open();
  }

  getItemText(item: string): string {
    return this.displayItems[this.items.indexOf(item)];
  }

  getItems(): string[] {
    return this.items;
  }

  selectSuggestion(value: FuzzyMatch<string>, evt: MouseEvent | KeyboardEvent) {
    this.resolved = true;
    super.selectSuggestion(value, evt);
  }

  onChooseItem(item: string): void {
    this.resolved = true;
    this.resolvePromise(item);
  }

  onClose() {
    super.onClose();

    if (!this.resolved) {
      this.rejectPromise("no input given.");
    }
  }
}
