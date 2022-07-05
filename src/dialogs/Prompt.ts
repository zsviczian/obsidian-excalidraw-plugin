import {
  App,
  ButtonComponent,
  Modal,
  TextComponent,
  FuzzyMatch,
  FuzzySuggestModal,
  Instruction,
  TFile,
  Notice,
} from "obsidian";
import ExcalidrawView from "../ExcalidrawView";
import ExcalidrawPlugin from "../main";
import { sleep } from "../utils/Utils";
import { getNewOrAdjacentLeaf } from "../utils/ObsidianUtils";

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
  private buttons: [{ caption: string; action: Function }];
  private readonly placeholder: string;

  public static Prompt(
    app: App,
    header: string,
    placeholder?: string,
    value?: string,
    buttons?: [{ caption: string; action: Function }],
  ): Promise<string> {
    const newPromptModal = new GenericInputPrompt(
      app,
      header,
      placeholder,
      value,
      buttons,
    );
    return newPromptModal.waitForClose;
  }

  protected constructor(
    app: App,
    private header: string,
    placeholder?: string,
    value?: string,
    buttons?: [{ caption: string; action: Function }],
  ) {
    super(app);
    this.placeholder = placeholder;
    this.input = value;
    this.buttons = buttons;

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
    if (this.buttons && this.buttons.length > 0) {
      let b = null;
      for (const button of this.buttons) {
        const btn = new ButtonComponent(buttonBarContainer);
        btn.setButtonText(button.caption).onClick((evt: MouseEvent) => {
          const res = button.action(this.input);
          if (res) {
            this.input = res;
          }
          this.submit();
        });
        b = b ?? btn;
      }
      if (b) {
        b.setCta().buttonEl.style.marginRight = "0";
      }
    } else {
      this.createButton(
        buttonBarContainer,
        "Ok",
        this.submitClickCallback,
      ).setCta().buttonEl.style.marginRight = "0";
    }
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
    this.inputComponent?.inputEl?.removeEventListener(
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

export class GenericSuggester extends FuzzySuggestModal<any> {
  private resolvePromise: (value: any) => void;
  private rejectPromise: (reason?: any) => void;
  public promise: Promise<any>;
  private resolved: boolean;

  public static Suggest(
    app: App,
    displayItems: string[],
    items: string[],
    hint?: string,
    instructions?: Instruction[],
  ) {
    const newSuggester = new GenericSuggester(
      app,
      displayItems,
      items,
      hint,
      instructions,
    );
    return newSuggester.promise;
  }

  public constructor(
    app: App,
    private displayItems: string[],
    private items: any[],
    private hint?: string,
    private instructions?: Instruction[],
  ) {
    super(app);
    this.limit = 20;
    this.setPlaceholder(this.hint ?? "");
    if (instructions) {
      this.setInstructions(this.instructions);
    }
    this.promise = new Promise<any>((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
    });

    this.open();
  }

  getItemText(item: string): string {
    return this.displayItems[this.items.indexOf(item)];
  }

  getItems(): any[] {
    return this.items;
  }

  selectSuggestion(value: FuzzyMatch<string>, evt: MouseEvent | KeyboardEvent) {
    this.resolved = true;
    super.selectSuggestion(value, evt);
  }

  onChooseItem(item: any): void {
    this.resolved = true;
    this.resolvePromise(item);
  }

  onClose() {
    super.onClose();
    if (!this.resolved) {
      this.rejectPromise(this.inputEl.value);
    }
  }
}

class MigrationPrompt extends Modal {
  private plugin: ExcalidrawPlugin;

  constructor(app: App, plugin: ExcalidrawPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    this.titleEl.setText("Welcome to Excalidraw 1.2");
    this.createForm();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  createForm(): void {
    const div = this.contentEl.createDiv();
    //    div.addClass("excalidraw-prompt-div");
    //    div.style.maxWidth = "600px";
    div.createEl("p", {
      text: "This version comes with tons of new features and possibilities. Please read the description in Community Plugins to find out more.",
    });
    div.createEl("p", { text: "" }, (el) => {
      el.innerHTML =
        "Drawings you've created with version 1.1.x need to be converted to take advantage of the new features. You can also continue to use them in compatibility mode. " +
        "During conversion your old *.excalidraw files will be replaced with new *.excalidraw.md files.";
    });
    div.createEl("p", { text: "" }, (el) => {
      //files manually follow one of two options:
      el.innerHTML =
        "To convert your drawings you have the following options:<br><ul>" +
        "<li>Click <code>CONVERT FILES</code> now to convert all of your *.excalidraw files, or if you prefer to make a backup first, then click <code>CANCEL</code>.</li>" +
        "<li>In the Command Palette select <code>Excalidraw: Convert *.excalidraw files to *.excalidraw.md files</code></li>" +
        "<li>Right click an <code>*.excalidraw</code> file in File Explorer and select one of the following options to convert files one by one: <ul>" +
        "<li><code>*.excalidraw => *.excalidraw.md</code></li>" +
        "<li><code>*.excalidraw => *.md (Logseq compatibility)</code>. This option will retain the original *.excalidraw file next to the new Obsidian format. " +
        "Make sure you also enable <code>Compatibility features</code> in Settings for a full solution.</li></ul></li>" +
        "<li>Open a drawing in compatibility mode and select <code>Convert to new format</code> from the <code>Options Menu</code></li></ul>";
    });
    div.createEl("p", {
      text: "This message will only appear maximum 3 times in case you have *.excalidraw files in your Vault.",
    });
    const bConvert = div.createEl("button", { text: "CONVERT FILES" });
    bConvert.onclick = () => {
      this.plugin.convertExcalidrawToMD();
      this.close();
    };
    const bCancel = div.createEl("button", { text: "CANCEL" });
    bCancel.onclick = () => {
      this.close();
    };
  }
}

export class NewFileActions extends Modal {
  constructor(
    private plugin: ExcalidrawPlugin,
    private path: string,
    private newPane: boolean,
    private newWindow: boolean,
    private view: ExcalidrawView,
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    this.createForm();
  }

  async onClose() {}

  openFile(file: TFile): void {
    if (!file) {
      return;
    }
    const leaf = this.newWindow
      //@ts-ignore
      ? app.workspace.openPopoutLeaf()
      : this.newPane
        ? getNewOrAdjacentLeaf(this.plugin, this.view.leaf)
        : this.view.leaf;
    leaf.openFile(file, {active:true});
    //this.app.workspace.setActiveLeaf(leaf, true, true);
  }

  createForm(): void {
    this.titleEl.setText("New File");

    this.contentEl.createDiv({
      cls: "excalidraw-prompt-center",
      text: "File does not exist. Do you want to create it?",
    });
    this.contentEl.createDiv({
      cls: "excalidraw-prompt-center filepath",
      text: this.path,
    });

    this.contentEl.createDiv({ cls: "excalidraw-prompt-center" }, (el) => {
      //files manually follow one of two options:
      el.style.textAlign = "right";

      const checks = (): boolean => {
        if (!this.path || this.path === "") {
          new Notice("Error: Filename for new file may not be empty");
          return false;
        }
        if (!this.view.file) {
          new Notice(
            "Unknown error. It seems as if your drawing was closed or the drawing file is missing",
          );
          return false;
        }
        return true;
      };

      const createFile = async (data: string): Promise<TFile> => {
        if (!this.path.includes("/")) {
          const re = new RegExp(`${this.view.file.name}$`, "g");
          this.path = this.view.file.path.replace(re, this.path);
        }
        if (!this.path.match(/\.md$/)) {
          this.path = `${this.path}.md`;
        }
        const f = await this.app.vault.create(this.path, data);
        return f;
      };

      const bMd = el.createEl("button", { text: "Create Markdown" });
      bMd.onclick = async () => {
        if (!checks) {
          return;
        }
        const f = await createFile("");
        this.openFile(f);
        this.close();
      };

      const bEx = el.createEl("button", { text: "Create Excalidraw" });
      bEx.onclick = async () => {
        if (!checks) {
          return;
        }
        const f = await createFile(await this.plugin.getBlankDrawing());
        await sleep(200); //wait for metadata cache to update, so file opens as excalidraw
        this.openFile(f);
        this.close();
      };

      const bCancel = el.createEl("button", {
        text: "Never Mind",
      });
      bCancel.onclick = () => {
        this.close();
      };
    });
  }
}
