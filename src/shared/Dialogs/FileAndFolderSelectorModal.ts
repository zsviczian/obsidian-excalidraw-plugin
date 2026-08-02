import { Modal, Setting, type App, type ButtonComponent } from "obsidian";
import { t } from "src/lang/helpers";
import { VaultPathSuggest } from "src/shared/Suggesters/VaultPathSuggest";

/** Folder and filename selected in a {@link FileAndFolderSelectorModal}. */
export type FileAndFolderSelection = {
  folderPath: string;
  fileName: string;
};

/** Labels and initial values for a {@link FileAndFolderSelectorModal}. */
export type FileAndFolderSelectorOptions = FileAndFolderSelection & {
  title: string;
  folderLabel: string;
  fileNameLabel: string;
  submitButtonText: string;
};

/** Prompts for a Vault folder and filename. */
export class FileAndFolderSelectorModal extends Modal {
  private resolvePromise: (
    selection: FileAndFolderSelection | null,
  ) => void;
  private result: FileAndFolderSelection | null = null;

  constructor(
    app: App,
    private readonly options: FileAndFolderSelectorOptions,
  ) {
    super(app);
  }

  /** Opens the modal and resolves with the selection or null when cancelled. */
  public start(): Promise<FileAndFolderSelection | null> {
    const result = new Promise<FileAndFolderSelection | null>((resolve) => {
      this.resolvePromise = resolve;
    });
    this.open();
    return result;
  }

  public onOpen(): void {
    this.titleEl.setText(this.options.title);
    this.contentEl.addClass("excalidraw-file-and-folder-selector");

    let folderPath = this.options.folderPath;
    let fileName = this.options.fileName;
    let submitButton: ButtonComponent | null = null;
    const updateSubmitButton = (): void => {
      submitButton?.setDisabled(fileName.trim().length === 0);
    };

    const folderSetting = new Setting(this.contentEl)
      .setClass("excalidraw-file-and-folder-selector__field")
      .setName(this.options.folderLabel)
      .addText((text) => {
        text.setValue(folderPath).onChange((value) => {
          folderPath = value.trim();
        });
        new VaultPathSuggest(this.app, text.inputEl, "folder");
      });
    folderSetting.controlEl.addClass("excalidraw-folder-path-control");

    let fileNameInput: HTMLInputElement | null = null;
    new Setting(this.contentEl)
      .setClass("excalidraw-file-and-folder-selector__field")
      .setName(this.options.fileNameLabel)
      .addText((text) => {
        fileNameInput = text.inputEl;
        text.setValue(fileName).onChange((value) => {
          fileName = value;
          updateSubmitButton();
        });
      });

    new Setting(this.contentEl)
      .addButton((button) =>
        button
          .setButtonText(t("PROMPT_BUTTON_CANCEL"))
          .onClick(() => this.close()),
      )
      .addButton((button) => {
        submitButton = button;
        button
          .setCta()
          .setButtonText(this.options.submitButtonText)
          .onClick(() => {
            this.result = {
              folderPath,
              fileName: fileName.trim(),
            };
            this.close();
          });
        updateSubmitButton();
      });

    this.containerEl.ownerDocument.defaultView?.setTimeout(
      () => fileNameInput?.focus(),
      0,
    );
  }

  public onClose(): void {
    this.contentEl.empty();
    this.resolvePromise?.(this.result);
  }
}
