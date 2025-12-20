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
import ExcalidrawView from "../../view/ExcalidrawView";
import ExcalidrawPlugin from "../../core/main";
import { escapeRegExp, getLinkParts, sleep } from "../../utils/utils";
import { getLeaf, openLeaf } from "../../utils/obsidianUtils";
import { createOrOverwriteFile } from "src/utils/fileUtils";
import { KeyEvent, isWinCTRLorMacCMD } from "src/utils/modifierkeyHelper";
import { t } from "src/lang/helpers";
import { ExcalidrawElement, getEA } from "src/core";
import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import { MAX_IMAGE_SIZE, REG_LINKINDEX_INVALIDCHARS } from "src/constants/constants";
import { REGEX_LINK, REGEX_TAGS } from "../ExcalidrawData";
import { ScriptEngine } from "../Scripts";
import { openExternalLink, openTagSearch, parseObsidianLink } from "src/utils/excalidrawViewUtils";
import { ButtonDefinition } from "src/types/promptTypes";
import { EditorView, keymap } from "@codemirror/view"
import { parser } from "./math-only";
import { LRLanguage } from "@codemirror/language";
import { EditorState, Prec } from "@codemirror/state";

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

export class LaTexPrompt extends Modal {
  public waitForClose : Promise<string>;
  private promptEl: HTMLInputElement;
  private resolvePromise: (input: string) => void;
  private rejectPromise: (reason?: any) => void;
  private editorView : EditorView;
  private latexsSuitePlugin : any;

  protected constructor(
    app: App,
    private prompt_text: string,
    private default_value?: string,
  ) {
    super(app);
    this.titleEl.setText(this.prompt_text);
    this.latexsSuitePlugin = app.plugins.plugins["obsidian-latex-suite"];
    const mainContentContainer: HTMLDivElement = this.contentEl.createDiv();
    this.display(default_value, mainContentContainer);
    this.waitForClose = new Promise<string>((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
    });
    this.editorView.focus();
  }

  public static Prompt(app: App,
    prompt_text?: string,
    default_value?: string,
  ): Promise<string>{
    const latexprompt = new LaTexPrompt(app, prompt_text, default_value);

    return latexprompt.waitForClose;
  }

  private display(value : string, container : HTMLDivElement) {
    if (this.latexsSuitePlugin) {
      // the language put eveything in a "math" node
      // surrounded by "math-begin" and "math-end" 
      // so that latex-suite always thinks we are in mathmode
      const language = LRLanguage.define({parser:parser});
      const extensions = [
        language, 
        ... this.latexsSuitePlugin.editorExtensions
      ];

      this.editorView = new EditorView({ 
        doc: value, 
        parent : container,
        extensions : extensions,
      });
    } else {
      this.editorView = new EditorView({ 
        doc: value, 
        parent : container,
      });
    }
    
    const buttonBarContainer: HTMLDivElement = container.createDiv();
    buttonBarContainer.addClass(`excalidraw-prompt-buttonbar-bottom`);
    const actionButtonContainer: HTMLDivElement = buttonBarContainer.createDiv();

    this.createButton(
        actionButtonContainer,
        "✅",
        this.submitCallback.bind(this),
      ).setCta().buttonEl.style.marginRight = "0";
    this.createButton(
        actionButtonContainer, 
        "❌", 
        this.cancelCallback.bind(this), 
        t("PROMPT_BUTTON_CANCEL"));
    this.open();
  }

  private createButton(container: HTMLElement,
    text: string,
    callback: (evt: MouseEvent) => any,
    tooltip: string = "",
    margin: string = "5px",
  ){
    const btn = new ButtonComponent(container);
    btn.buttonEl.style.padding = "0.5em";
    btn.buttonEl.style.marginLeft = margin;
    btn.setTooltip(tooltip);
    btn.setButtonText(text).onClick(callback);
    return btn;
  }
  
  private submitCallback(){
    const res = this.editorView.state.doc.toString();
    if (res.trim().length == 0) {
      this.rejectPromise("empty latex");
    } else { 
      this.resolvePromise(res);
    }
    this.close();
  }

  private cancelCallback(){
    this.rejectPromise("Canceled input");
    this.close();
  }

  onOpen(): void {
    super.onOpen();
    this.editorView.focus();
  }

  onClose(): void {
    this.contentEl.empty();
    this.editorView.destroy();
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
  private controlsOnTop: boolean = false;
  private draggable: boolean = false;
  private cleanupDragListeners: (() => void) | null = null;

  // Add event handler instance properties
  private handleKeyDown = (evt: KeyboardEvent) => {
    if ((evt.key === "Enter" && this.lines === 1) || (isWinCTRLorMacCMD(evt) && evt.key === "Enter")) {
      evt.preventDefault();
      this.submit();
    }
    if (this.displayEditorButtons && evt.key === "k" && isWinCTRLorMacCMD(evt)) {
      evt.preventDefault();
      this.linkBtnClickCallback();
    } 
  };

  private handleCheckCaret = () => {
    //timer is implemented because on iPad with pencil the button click generates an event on the textarea
    this.selectionUpdateTimer = this.view.ownerWindow.setTimeout(() => {
      this.selectionStart = this.inputComponent.inputEl.selectionStart;
      this.selectionEnd = this.inputComponent.inputEl.selectionEnd;
    }, 30);
  };

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
    controlsOnTop?: boolean,
    draggable?: boolean,
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
      controlsOnTop,
      draggable,
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
    controlsOnTop?: boolean,
    draggable?: boolean,
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
    this.controlsOnTop = controlsOnTop ?? false;
    this.draggable = draggable ?? false;

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
    
    // Conditionally order elements based on controlsOnTop flag
    if (this.controlsOnTop) {
      // Create button bar first
      this.customComponents?.(mainContentContainer);
      this.createButtonBar(mainContentContainer);
      
      // Then add input field and custom components
      this.inputComponent = this.createInputField(
        mainContentContainer,
        this.placeholder,
        this.input
      );
    } else {
      // Original order: input field, custom components, then buttons
      this.inputComponent = this.createInputField(
        mainContentContainer,
        this.placeholder,
        this.input
      );
      this.customComponents?.(mainContentContainer);
      this.createButtonBar(mainContentContainer);
    }
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

    textComponent.inputEl.addEventListener("keydown", this.handleKeyDown);
    textComponent.inputEl.addEventListener('keyup', this.handleCheckCaret);
    textComponent.inputEl.addEventListener('pointerup', this.handleCheckCaret);
    textComponent.inputEl.addEventListener('touchend', this.handleCheckCaret);
    textComponent.inputEl.addEventListener('input', this.handleCheckCaret);
    textComponent.inputEl.addEventListener('paste', this.handleCheckCaret);
    textComponent.inputEl.addEventListener('cut', this.handleCheckCaret);
    textComponent.inputEl.addEventListener('select', this.handleCheckCaret);
    textComponent.inputEl.addEventListener('selectionchange', this.handleCheckCaret);
      
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
    buttonBarContainer.addClass(`excalidraw-prompt-buttonbar-${this.controlsOnTop ? "top" : "bottom"}`);
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
        this.submitClickCallback.bind(this),
      ).setCta().buttonEl.style.marginRight = "0";
    }
    this.createButton(actionButtonContainer, "❌", this.cancelClickCallback.bind(this), t("PROMPT_BUTTON_CANCEL"));
    if(this.displayEditorButtons) {
      this.createButton(editorButtonContainer, "⏎", ()=>this.insertStringBtnClickCallback("\n"), t("PROMPT_BUTTON_INSERT_LINE"), "0");
      this.createButton(editorButtonContainer, "⌫", this.delBtnClickCallback.bind(this), "Delete");
      this.createButton(editorButtonContainer, "⎵", ()=>this.insertStringBtnClickCallback(" "), t("PROMPT_BUTTON_INSERT_SPACE"));
      this.createButton(editorButtonContainer, "§", this.specialCharsBtnClickCallback.bind(this), t("PROMPT_BUTTON_SPECIAL_CHARS"));
      if(this.view) {
        this.createButton(editorButtonContainer, "🔗", this.linkBtnClickCallback.bind(this), t("PROMPT_BUTTON_INSERT_LINK"));
      }
      this.createButton(editorButtonContainer, "🔠", this.uppercaseBtnClickCallback.bind(this), t("PROMPT_BUTTON_UPPERCASE"));
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

  private submitClickCallback () {
    this.submit();
  }

  private cancelClickCallback () {
    this.cancel();
  }

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
    if (!this.inputComponent?.inputEl) return;
    
    const inputEl = this.inputComponent.inputEl;
    inputEl.removeEventListener("keydown", this.handleKeyDown);
    inputEl.removeEventListener('keyup', this.handleCheckCaret);
    inputEl.removeEventListener('pointerup', this.handleCheckCaret);
    inputEl.removeEventListener('touchend', this.handleCheckCaret);
    inputEl.removeEventListener('input', this.handleCheckCaret);
    inputEl.removeEventListener('paste', this.handleCheckCaret);
    inputEl.removeEventListener('cut', this.handleCheckCaret);
    inputEl.removeEventListener('select', this.handleCheckCaret);
    inputEl.removeEventListener('selectionchange', this.handleCheckCaret);
  }

  private specialCharsBtnClickCallback = (evt: MouseEvent) => {
    this.view.ownerWindow.clearTimeout(this.selectionUpdateTimer);
    
    // Remove any existing popup
    const existingPopup = document.querySelector('.excalidraw-special-chars-popup');
    if (existingPopup) {
      existingPopup.remove();
      return;
    }
    
    // Create popup element
    const popup = document.createElement('div');
    popup.className = 'excalidraw-special-chars-popup';
    popup.style.position = 'absolute';
    popup.style.zIndex = '1000';
    popup.style.background = 'var(--background-primary)';
    popup.style.border = '1px solid var(--background-modifier-border)';
    popup.style.borderRadius = '4px';
    popup.style.padding = '4px';
    popup.style.boxShadow = '0 2px 8px var(--background-modifier-box-shadow)';
    popup.style.display = 'flex';
    popup.style.flexWrap = 'wrap';
    popup.style.maxWidth = '200px';
    
    // Position near the button
    const rect = (evt.target as HTMLElement).getBoundingClientRect();
    popup.style.top = `${rect.bottom + 5}px`;
    popup.style.left = `${rect.left}px`;
    
    // Special characters to include
    const specialChars = [',', '.', ':', ';', '!', '?', '"', '{', '}', '[', ']', '(', ')'];
    
    // Add character buttons
    specialChars.forEach(char => {
      const charButton = document.createElement('button');
      charButton.textContent = char;
      charButton.style.margin = '2px';
      charButton.style.width = '28px';
      charButton.style.height = '28px';
      charButton.style.cursor = 'pointer';
      charButton.style.background = 'var(--interactive-normal)';
      charButton.style.border = 'none';
      charButton.style.borderRadius = '4px';
      
      charButton.addEventListener('click', () => {
        this.insertStringBtnClickCallback(char);
        popup.remove();
      });
      
      popup.appendChild(charButton);
    });
    
    // Add click outside listener to close popup
    const closePopupListener = (e: MouseEvent) => {
      if (!popup.contains(e.target as Node) && 
          (evt.target as HTMLElement) !== e.target) {
        popup.remove();
        document.removeEventListener('click', closePopupListener);
      }
    };
    
    // Add to document and set up listeners
    document.body.appendChild(popup);
    setTimeout(() => {
      document.addEventListener('click', closePopupListener);
    }, 10);
  }

  onOpen() {
    super.onOpen();
    this.modalEl.classList.add("excalidraw-modal");
    this.containerEl.classList.add("excalidraw-modal");
    this.inputComponent.inputEl.focus();
    this.inputComponent.inputEl.select();
    
    if (this.draggable) {
      this.makeModalDraggable();
    }
  }

  private makeModalDraggable() {
    let isDragging = false;
    let startX: number, startY: number, initialX: number, initialY: number;
    let activeElement: HTMLElement | null = null;
    let cursorPosition: { start: number; end: number } | null = null;

    const modalEl = this.modalEl;
    const header = modalEl.querySelector('.modal-titlebar') || modalEl.querySelector('.modal-title') || modalEl;
    (header as HTMLElement).style.cursor = 'move';

    // Track focus changes to store the last focused interactive element
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'SELECT' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON')) {
        activeElement = target;
        // Store cursor position for input/textarea elements (but not for number inputs)
        if (target.tagName === 'TEXTAREA' || 
            (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'number')) {
          const inputEl = target as HTMLInputElement | HTMLTextAreaElement;
          cursorPosition = {
            start: inputEl.selectionStart || 0,
            end: inputEl.selectionEnd || 0
          };
        } else {
          cursorPosition = null;
        }
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      
      // Don't allow dragging if clicking on interactive controls
      if (target.tagName === 'INPUT' || 
          target.tagName === 'TEXTAREA' || 
          target.tagName === 'BUTTON' ||
          target.tagName === 'SELECT' ||
          target.closest('button') ||
          target.closest('input') ||
          target.closest('textarea') ||
          target.closest('select')) {
        return;
      }
      
      // Allow dragging from header or modal content areas
      if (!header.contains(target) && !modalEl.querySelector('.modal-content')?.contains(target)) {
        return;
      }
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = modalEl.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;

      modalEl.style.position = 'absolute';
      modalEl.style.margin = '0';
      modalEl.style.left = `${initialX}px`;
      modalEl.style.top = `${initialY}px`;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      modalEl.style.left = `${initialX + dx}px`;
      modalEl.style.top = `${initialY + dy}px`;
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      isDragging = false;

      // Restore focus and cursor position
      if (activeElement && activeElement.isConnected) {
        // Use setTimeout to ensure the pointer event is fully processed
        setTimeout(() => {
          activeElement.focus();
          
          // Restore cursor position for input/textarea elements (but not for number inputs)
          if (cursorPosition && 
              (activeElement.tagName === 'TEXTAREA' || 
               (activeElement.tagName === 'INPUT' && (activeElement as HTMLInputElement).type !== 'number'))) {
            const inputEl = activeElement as HTMLInputElement | HTMLTextAreaElement;
            inputEl.setSelectionRange(cursorPosition.start, cursorPosition.end);
          }
        }, 0);
      }
    };

    // Initialize activeElement with the main input field
    activeElement = this.inputComponent.inputEl;
    cursorPosition = {
      start: this.inputComponent.inputEl.selectionStart || 0,
      end: this.inputComponent.inputEl.selectionEnd || 0
    };

    // Set up event listeners
    modalEl.addEventListener('focusin', onFocusIn);
    modalEl.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);

    // Store cleanup function for use in onClose
    this.cleanupDragListeners = () => {
      modalEl.removeEventListener('focusin', onFocusIn);
      modalEl.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };
  }

  onClose() {
    super.onClose();
    this.resolveInput();
    this.removeInputListener();
    
    // Clean up drag listeners to prevent memory leaks
    if (this.cleanupDragListeners) {
      this.cleanupDragListeners();
      this.cleanupDragListeners = null;
    }
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

export class NewFileActions extends Modal {
  public waitForClose: Promise<TFile|null>;
  private resolvePromise: (file: TFile|null) => void;
  private rejectPromise: (reason?: any) => void;
  private newFile: TFile = null;
  private plugin: ExcalidrawPlugin;
  private path: string;
  private keys: KeyEvent;
  private view: ExcalidrawView;
  private openNewFile: boolean;
  private parentFile: TFile;
  private sourceElement: ExcalidrawElement;

  constructor({
    plugin,
    path,
    keys,
    view,
    openNewFile = true,
    parentFile,
    sourceElement,
  }: {
    plugin: ExcalidrawPlugin;
    path: string;
    keys: KeyEvent;
    view: ExcalidrawView;
    openNewFile?: boolean;
    parentFile?: TFile;
    sourceElement?: ExcalidrawElement;
  }) {
    super(plugin.app);
    this.plugin = plugin;
    this.path = path;
    this.keys = keys;
    this.view = view;
    this.openNewFile = openNewFile;
    this.sourceElement = sourceElement;
    this.parentFile = parentFile ?? view.file;
    this.waitForClose = new Promise<TFile|null>((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
    });
  } 

  onOpen(): void {
    this.createForm();
  }

  openFile(file: TFile): void {
    this.newFile = file;
    if (!file || !this.openNewFile) {
      return;
    }
    openLeaf({
      plugin: this.plugin,
      fnGetLeaf: () => getLeaf(this.plugin,this.view.leaf,this.keys),
      file,
      openState: { active: true },
    });
  }

  onClose() {
    super.onClose();
    this.resolvePromise(this.newFile);
    this.app = null;
    this.plugin = null;
    this.view = null;
    this.parentFile = null;
    this.sourceElement = null;
  }

  createForm(): void {
    this.titleEl.setText(t("PROMPT_TITLE_NEW_FILE"));

    this.contentEl.createDiv({
      cls: "excalidraw-prompt-center",
      text: t("PROMPT_FILE_DOES_NOT_EXIST"),
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
          new Notice(t("PROMPT_ERROR_NO_FILENAME"));
          return false;
        }
        if (!this.parentFile) {
          new Notice(
            t("PROMPT_ERROR_DRAWING_CLOSED"),
          );
          return false;
        }
        return true;
      };

      const createFile = async (data: string): Promise<TFile> => {
        if (!this.path.includes("/")) {
          const re = new RegExp(`${escapeRegExp(this.parentFile.name)}$`, "g");
          this.path = this.parentFile.path.replace(re, this.path);
        }
        if (!this.path.match(/\.md$/)) {
          this.path = `${this.path}.md`;
        }
        return await createOrOverwriteFile(this.app, this.path, data);
      };

      if(this.sourceElement) {
        const bEmbedMd = el.createEl("button", {
          text: t("PROMPT_BUTTON_EMBED_MARKDOWN"),
          attr: {"aria-label": t("PROMPT_BUTTON_EMBED_MARKDOWN_ARIA")},
        });
        bEmbedMd.onclick = async () => {
          if (!checks) {
            return;
          }
          const f = await createFile("");
          if(f) {
            const ea:ExcalidrawAutomate = getEA(this.view);
            ea.copyViewElementsToEAforEditing([this.sourceElement]);
            ea.getElement(this.sourceElement.id).isDeleted = true;
            ea.addEmbeddable(this.sourceElement.x, this.sourceElement.y,MAX_IMAGE_SIZE, MAX_IMAGE_SIZE, undefined,f);
            await ea.addElementsToView();
            ea.destroy();
          }
          this.close();
        };
      }

      const bMd = el.createEl("button", {
        text: t("PROMPT_BUTTON_CREATE_MARKDOWN"),
        attr: {"aria-label": t("PROMPT_BUTTON_CREATE_MARKDOWN_ARIA")},
      });
      bMd.onclick = async () => {
        if (!checks) {
          return;
        }
        const f = await createFile("");
        this.openFile(f);
        this.close();
      };

      const bEx = el.createEl("button", {
        text: t("PROMPT_BUTTON_CREATE_EXCALIDRAW"),
        attr: {"aria-label": t("PROMPT_BUTTON_CREATE_EXCALIDRAW_ARIA")},
      });
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
        text: t("PROMPT_BUTTON_NEVERMIND"),
      });
      bCancel.onclick = () => {
        this.close();
      };
    });
  }
}

export class MultiOptionConfirmationPrompt extends Modal {
  public waitForClose: Promise<any>;
  private resolvePromise: (value: any) => void;
  private rejectPromise: (reason?: any) => void;
  private selectedValue: any = null;
  private readonly message: string;
  private readonly buttons: Map<string, any>;
  private ctaButtonLabel: string = null;

  constructor(private plugin: ExcalidrawPlugin, message: string, buttons?: Map<string, any>, ctaButtonLabel?: string) {
    super(plugin.app);
    this.message = message;
    if (!buttons || buttons.size === 0) {
      buttons = new Map<string, any>([
        [t("PROMPT_BUTTON_CANCEL"), null],
        [t("PROMPT_BUTTON_OK"), true],
      ]);
      if( !ctaButtonLabel) {
        ctaButtonLabel = t("PROMPT_BUTTON_OK");
      } 
    }
    this.ctaButtonLabel = ctaButtonLabel;
    this.buttons = buttons;
    this.waitForClose = new Promise<any>((resolve, reject) => {
      this.resolvePromise = resolve;
      this.rejectPromise = reject;
    });

    this.display();
    this.open();
  }

  private display() {
    this.contentEl.empty();
    this.titleEl.textContent = t("PROMPT_TITLE_CONFIRMATION");

    const messageEl = this.contentEl.createDiv();
    messageEl.style.marginBottom = "1rem";
    messageEl.innerHTML = this.message;

    const buttonContainer = this.contentEl.createDiv();
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.flexWrap = "wrap";
    
    // Convert Map to Array for easier iteration
    const buttonEntries = Array.from(this.buttons.entries());

    // Add buttons in reverse order (last button will be on the right)
    let ctaButton: HTMLButtonElement = null;
    buttonEntries.reverse().forEach(([buttonText, value], index) => {
      const button = this.createButton(buttonContainer, buttonText, () => {
        this.selectedValue = value;
        this.close();
      });
      
      if (buttonText === this.ctaButtonLabel) {
        ctaButton = button.buttonEl;
        button.setCta();
      }
      
      if (index < buttonEntries.length - 1) {
        button.buttonEl.style.marginRight = "0.5rem";
      }
    });

    // Set focus on the first button (visually last)
    if(this.ctaButtonLabel) {
      if (ctaButton) {
        ctaButton.focus();
      }
    }
  }

  private createButton(container: HTMLElement, text: string, callback: (evt: MouseEvent) => void) {
    const button = new ButtonComponent(container);
    button.setButtonText(text).onClick(callback);
    return button;
  }

  onOpen() {
    super.onOpen();
    this.contentEl.querySelector("button")?.focus();
  }

  onClose() {
    super.onClose();
    this.resolvePromise(this.selectedValue);
  }
}

export async function linkPrompt(
  linkText: string,
  app: App,
  view?: ExcalidrawView,
  message: string = t("SELECT_LINK_TO_OPEN"),
): Promise<[file: TFile, linkText: string, subpath: string]> {
  const linksArray = REGEX_LINK.getResList(linkText).filter(x => Boolean(x.value));
  const links = linksArray.map(x => REGEX_LINK.getLink(x));

  // Create a map to track duplicates by base link (without rect reference)
  const linkMap = new Map<string, number[]>();
  links.forEach((link, i) => {
    const linkBase = link.split("&rect=")[0];
    if (!linkMap.has(linkBase)) linkMap.set(linkBase, []);
    linkMap.get(linkBase).push(i);
  });

  // Determine indices to keep
  const indicesToKeep = new Set<number>();
  linkMap.forEach(indices => {
    if (indices.length === 1) {
      // Only one link, keep it
      indicesToKeep.add(indices[0]);
    } else {
      // Multiple links: prefer the one with rect reference, if available
      const rectIndex = indices.find(i => links[i].includes("&rect="));
      if (rectIndex !== undefined) {
        indicesToKeep.add(rectIndex);
      } else {
        // No rect reference in duplicates, add the first one
        indicesToKeep.add(indices[0]);
      }
    }
  });

  // Final validation to ensure each duplicate group has at least one entry
  linkMap.forEach(indices => {
    const hasKeptEntry = indices.some(i => indicesToKeep.has(i));
    if (!hasKeptEntry) {
      // Add the first index if none were kept
      indicesToKeep.add(indices[0]);
    }
  });

  // Filter linksArray, links, itemsDisplay, and items based on indicesToKeep
  const filteredLinksArray = linksArray.filter((_, i) => indicesToKeep.has(i));
  const tagsArray = REGEX_TAGS.getResList(linkText.replaceAll(/([^\s])#/g, "$1 ")).filter(x => Boolean(x.value));

  let subpath: string = null;
  let file: TFile = null;
  let parts = filteredLinksArray[0] ?? tagsArray[0];

  // Generate filtered itemsDisplay and items arrays
  const itemsDisplay = [
    ...filteredLinksArray.map(p => {
      const alias = REGEX_LINK.getAliasOrLink(p);
      return alias === "100%" ? REGEX_LINK.getLink(p) : alias;
    }),
    ...tagsArray.map(x => REGEX_TAGS.getTag(x)),
  ];

  const items = [
    ...filteredLinksArray,
    ...tagsArray,
  ];

  await sleep(10); //obsidian modal link click immediately refocuses the editor, so we need to wait a bit
  if (items.length>1) {
    parts = await ScriptEngine.suggester(
      app,
      itemsDisplay,
      items,
      message,
    );
    if(!parts) return;
  }

  if(!parts) {
    return;
  }
  
  if (REGEX_TAGS.isTag(parts)) {
    openTagSearch(REGEX_TAGS.getTag(parts), app);
    return;
  }

  linkText = REGEX_LINK.getLink(parts);
  if(openExternalLink(linkText, app)) return;
  const maybeObsidianLink = parseObsidianLink(linkText, app, false);
  if (typeof maybeObsidianLink === "boolean" && maybeObsidianLink) return;
  if (typeof maybeObsidianLink === "string") linkText = maybeObsidianLink;

  if (linkText.search("#") > -1) {
    const linkParts = getLinkParts(linkText, view ? view.file : undefined);
    subpath = `#${linkParts.isBlockRef ? "^" : ""}${linkParts.ref}`;
    linkText = linkParts.path;
  }
  if (linkText.match(REG_LINKINDEX_INVALIDCHARS)) {
    new Notice(t("FILENAME_INVALID_CHARS"), 4000);
    return;
  }
  file = app.metadataCache.getFirstLinkpathDest(
    linkText,
    view ? view.file.path : "",
  );
  return [file, linkText, subpath];
}

export const templatePromt = async (files: TFile[], app: App): Promise<TFile> => {
  if(files.length === 1) return files[0];
  return ((await linkPrompt(
    files.map(f=>`[[${f.path}|${f.name}]]`).join(" "),
    app,
    undefined,
    t("PROMPT_SELECT_TEMPLATE")
  ))??[null, null, null])[0];
}