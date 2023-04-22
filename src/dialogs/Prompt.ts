import {
  App,
  ButtonComponent,
  Modal,
  FuzzyMatch,
  FuzzySuggestModal,
  Instruction,
  TFile,
  Notice,
  TextAreaComponent,
} from "obsidian";
import ExcalidrawView from "../ExcalidrawView";
import ExcalidrawPlugin from "../main";
import { sleep } from "../utils/Utils";
import { getLeaf } from "../utils/ObsidianUtils";
import { checkAndCreateFolder, splitFolderAndFilename } from "src/utils/FileUtils";
import { KeyEvent, isCTRL } from "src/utils/ModifierkeyHelper";

export type ButtonDefinition = { caption: string; tooltip?:string; action: Function };

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
  private view: ExcalidrawView;
  private plugin: ExcalidrawPlugin;
  private resolvePromise: (input: string) => void;
  private rejectPromise: (reason?: any) => void;
  private didSubmit: boolean = false;
  private inputComponent: TextAreaComponent;
  private input: string;
  private buttons: ButtonDefinition[];
  private lines: number = 1;
  private displayEditorButtons: boolean = false;
  private readonly placeholder: string;
  private selectionStart: number = 0;
  private selectionEnd: number = 0;
  private selectionUpdateTimer: number = 0;
  private customComponents: (container: HTMLElement) => void;
  private blockPointerInputOutsideModal: boolean = false;

  public static Prompt(
    view: ExcalidrawView,
    plugin: ExcalidrawPlugin,
    app: App,
    header: string,
    placeholder?: string,
    value?: string,
    buttons?: ButtonDefinition[],
    lines?: number,
    displayEditorButtons?: boolean,
    customComponents?: (container: HTMLElement) => void,
    blockPointerInputOutsideModal?: boolean,
  ): Promise<string> {
    const newPromptModal = new GenericInputPrompt(
      view,
      plugin,
      app,
      header,
      placeholder,
      value,
      buttons,
      lines,
      displayEditorButtons,
      customComponents,
      blockPointerInputOutsideModal,
    );
    return newPromptModal.waitForClose;
  }

  protected constructor(
    view: ExcalidrawView,
    plugin: ExcalidrawPlugin,
    app: App,
    private header: string,
    placeholder?: string,
    value?: string,
    buttons?: { caption: string; action: Function }[],
    lines?: number,
    displayEditorButtons?: boolean,
    customComponents?: (container: HTMLElement) => void,
    blockPointerInputOutsideModal?: boolean,
  ) {
    super(app);
    this.view = view;
    this.plugin = plugin;
    this.placeholder = placeholder;
    this.input = value;
    this.buttons = buttons;
    this.lines = lines ?? 1;
    this.displayEditorButtons = this.lines > 1 ? (displayEditorButtons ?? false) : false;
    this.customComponents = customComponents;
    this.blockPointerInputOutsideModal = blockPointerInputOutsideModal ?? false;

    this.waitForClose = new Promise<string>((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
    });

    this.display();
    this.inputComponent.inputEl.focus();
    this.open();
  }

  private display() {
    this.contentEl.empty();
    if(this.blockPointerInputOutsideModal) {
      //@ts-ignore
      const bgEl = this.bgEl;
      bgEl.style.pointerEvents = this.blockPointerInputOutsideModal ? "none" : "auto";
    }

    this.titleEl.textContent = this.header;

    const mainContentContainer: HTMLDivElement = this.contentEl.createDiv();
    this.inputComponent = this.createInputField(
      mainContentContainer,
      this.placeholder,
      this.input
    );
    this.customComponents?.(mainContentContainer);
    this.createButtonBar(mainContentContainer);
  }

  protected createInputField(
    container: HTMLElement,
    placeholder?: string,
    value?: string,
  ) {
    const textComponent = new TextAreaComponent(container);

    textComponent.inputEl.style.width = "100%";
    textComponent.inputEl.style.height = `${this.lines*2}em`;
    if(this.lines === 1) {
      textComponent.inputEl.style.resize = "none";
      textComponent.inputEl.style.overflow = "hidden";
    }
    textComponent
      .setPlaceholder(placeholder ?? "")
      .setValue(value ?? "")
      .onChange((value) => (this.input = value));

    let i = 0;

    const checkcaret = () => {
      //timer is implemented because on iPad with pencil the button click generates an event on the textarea
      this.selectionUpdateTimer = this.view.ownerWindow.setTimeout(() => {
        this.selectionStart = this.inputComponent.inputEl.selectionStart;
        this.selectionEnd = this.inputComponent.inputEl.selectionEnd;
      }, 30);
    }

    textComponent.inputEl.addEventListener("keydown", this.keyDownCallback);
    textComponent.inputEl.addEventListener('keyup', checkcaret); // Every character written
    textComponent.inputEl.addEventListener('pointerup', checkcaret); // Click down
    textComponent.inputEl.addEventListener('touchend', checkcaret); // Click down
    textComponent.inputEl.addEventListener('input', checkcaret); // Other input events
    textComponent.inputEl.addEventListener('paste', checkcaret); // Clipboard actions
    textComponent.inputEl.addEventListener('cut', checkcaret);
    textComponent.inputEl.addEventListener('select', checkcaret); // Some browsers support this event
    textComponent.inputEl.addEventListener('selectionchange', checkcaret);// Some browsers support this event
      
    return textComponent;
  }

  private createButton(
    container: HTMLElement,
    text: string,
    callback: (evt: MouseEvent) => any,
    tooltip: string = "",
    margin: string = "5px",
  ) {
    const btn = new ButtonComponent(container);
    btn.buttonEl.style.padding = "0.5em";
    btn.buttonEl.style.marginLeft = margin;
    btn.setTooltip(tooltip);
    btn.setButtonText(text).onClick(callback);
    return btn;
  }

  private createButtonBar(mainContentContainer: HTMLDivElement) {
    const buttonBarContainer: HTMLDivElement = mainContentContainer.createDiv();
    buttonBarContainer.style.display = "flex";
    buttonBarContainer.style.justifyContent = "space-between";
    buttonBarContainer.style.marginTop = "1rem";

    const editorButtonContainer: HTMLDivElement = buttonBarContainer.createDiv();

    const actionButtonContainer: HTMLDivElement = buttonBarContainer.createDiv();

    if (this.buttons && this.buttons.length > 0) {
      let b = null;
      for (const button of this.buttons) {
        const btn = new ButtonComponent(actionButtonContainer);
        btn.buttonEl.style.marginLeft="5px";
        if(button.tooltip) btn.setTooltip(button.tooltip);
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
        b.setCta();
        b.buttonEl.style.marginRight = "0";
      }
    } else {
      this.createButton(
        actionButtonContainer,
        "✅",
        this.submitClickCallback,
      ).setCta().buttonEl.style.marginRight = "0";
    }
    this.createButton(actionButtonContainer, "❌", this.cancelClickCallback, "Cancel");
    if(this.displayEditorButtons) {
      this.createButton(editorButtonContainer, "⏎", ()=>this.insertStringBtnClickCallback("\n"), "Insert new line", "0");
      this.createButton(editorButtonContainer, "⌫", this.delBtnClickCallback, "Delete");
      this.createButton(editorButtonContainer, "⎵", ()=>this.insertStringBtnClickCallback(" "), "Insert space");
      if(this.view) {
        this.createButton(editorButtonContainer, "🔗", this.linkBtnClickCallback, "Insert markdown link to file");
      }
      this.createButton(editorButtonContainer, "🔠", this.uppercaseBtnClickCallback, "Uppercase");
    }
  }

  private linkBtnClickCallback = () => {
    this.view.ownerWindow.clearTimeout(this.selectionUpdateTimer); //timer is implemented because on iPad with pencil the button click generates an event on the textarea
    const addText = (text: string) => {
      const v = this.inputComponent.inputEl.value;
      if(this.selectionStart>0 && v.slice(this.selectionStart-1, this.selectionStart) !== " ") text = " "+text;
      if(this.selectionStart<v.length && v.slice(this.selectionStart, this.selectionStart+1) !== " ") text = text+" ";
      const newVal = this.inputComponent.inputEl.value.slice(0, this.selectionStart) + text + this.inputComponent.inputEl.value.slice(this.selectionStart);
      this.inputComponent.inputEl.value = newVal;
      this.input = this.inputComponent.inputEl.value;
      this.inputComponent.inputEl.focus();
      this.selectionStart = this.selectionStart+text.length;
      this.selectionEnd = this.selectionStart+text.length;
      this.inputComponent.inputEl.setSelectionRange(this.selectionStart, this.selectionStart);

    }
    this.plugin.insertLinkDialog.start(this.view.file.path, addText);
  }

  private insertStringBtnClickCallback = (s: string) => {
    this.view.ownerWindow.clearTimeout(this.selectionUpdateTimer); //timer is implemented because on iPad with pencil the button click generates an event on the textarea
    const newVal = this.inputComponent.inputEl.value.slice(0, this.selectionStart) + s + this.inputComponent.inputEl.value.slice(this.selectionStart);
    this.inputComponent.inputEl.value = newVal;
    this.input = this.inputComponent.inputEl.value;
    this.inputComponent.inputEl.focus();
    this.selectionStart = this.selectionStart+1;
    this.selectionEnd = this.selectionStart;
    this.inputComponent.inputEl.setSelectionRange(this.selectionStart, this.selectionEnd);
  }
  
  private delBtnClickCallback = () => {
    this.view.ownerWindow.clearTimeout(this.selectionUpdateTimer); //timer is implemented because on iPad with pencil the button click generates an event on the textarea
    if(this.input.length === 0) return;
    const delStart = this.selectionEnd > this.selectionStart 
      ? this.selectionStart
      : this.selectionStart > 0 ? this.selectionStart-1 : 0;
    const delEnd = this.selectionEnd;
    const newVal = this.inputComponent.inputEl.value.slice(0, delStart ) + this.inputComponent.inputEl.value.slice(delEnd);
    this.inputComponent.inputEl.value = newVal;
    this.input = this.inputComponent.inputEl.value;
    this.inputComponent.inputEl.focus();
    this.selectionStart = delStart;
    this.selectionEnd = delStart;
    this.inputComponent.inputEl.setSelectionRange(delStart, delStart);
  }

  private uppercaseBtnClickCallback = () => {
    this.view.ownerWindow.clearTimeout(this.selectionUpdateTimer); //timer is implemented because on iPad with pencil the button click generates an event on the textarea
    if(this.selectionEnd === this.selectionStart) return;
    const newVal = this.inputComponent.inputEl.value.slice(0, this.selectionStart) + this.inputComponent.inputEl.value.slice(this.selectionStart, this.selectionEnd).toUpperCase() + this.inputComponent.inputEl.value.slice(this.selectionEnd);
    this.inputComponent.inputEl.value = newVal;
    this.input = this.inputComponent.inputEl.value;
    this.inputComponent.inputEl.focus();
    this.inputComponent.inputEl.setSelectionRange(this.selectionStart, this.selectionEnd);
  }

  private submitClickCallback = () => this.submit();
  private cancelClickCallback = () => this.cancel();

  private keyDownCallback = (evt: KeyboardEvent) => {
    if ((evt.key === "Enter" && this.lines === 1) || (isCTRL(evt) && evt.key === "Enter")) {
      evt.preventDefault();
      this.submit();
    }
    if (this.displayEditorButtons && evt.key === "k" && isCTRL(evt)) {
      evt.preventDefault();
      this.linkBtnClickCallback();
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
      this.keyDownCallback,
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
    private keys: KeyEvent,
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
    const leaf = getLeaf(this.plugin,this.view.leaf,this.keys)
    leaf.openFile(file, {active:true});
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
        const folderpath = splitFolderAndFilename(this.path).folderpath;
        checkAndCreateFolder(folderpath);
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
