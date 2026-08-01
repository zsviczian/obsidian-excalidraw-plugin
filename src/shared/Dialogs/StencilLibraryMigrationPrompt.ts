import { Modal, normalizePath, Setting, TextComponent } from "obsidian";
import type ExcalidrawPlugin from "src/core/main";
import { t } from "src/lang/helpers";
import { VaultPathSuggest } from "src/shared/Suggesters/VaultPathSuggest";
import type { StencilLibraryMigrationChoice } from "src/types/stencilLibraryTypes";
import { setElementHidden } from "src/utils/htmlUtils";
import { confirmAndCreateFolder } from "./CreateFolderPrompt";

export type StencilLibraryMigrationResult = {
  choice: StencilLibraryMigrationChoice;
  folderPath: string;
  fileName: string;
};

/** Explains and configures the one-time stencil-library storage migration. */
export class StencilLibraryMigrationPrompt extends Modal {
  private resolvePromise: (result: StencilLibraryMigrationResult) => void;
  private result: StencilLibraryMigrationResult;

  constructor(private readonly plugin: ExcalidrawPlugin) {
    super(plugin.app);
    this.result = {
      choice: "later",
      folderPath: plugin.settings.libraryFolderPath,
      fileName: plugin.settings.libraryFileName,
    };
  }

  public start(): Promise<StencilLibraryMigrationResult> {
    const result = new Promise<StencilLibraryMigrationResult>((resolve) => {
      this.resolvePromise = resolve;
    });
    this.open();
    return result;
  }

  onOpen(): void {
    this.titleEl.setText(t("LIBRARY_MIGRATION_TITLE"));
    this.contentEl.createEl("p", { text: t("LIBRARY_MIGRATION_DESC") });
    this.contentEl.createEl("p", {
      cls: "mod-warning",
      text: t("LIBRARY_MIGRATION_SYNC_WARNING"),
    });

    let folderText: TextComponent | null = null;
    let createFolderButtonEl: HTMLButtonElement | null = null;
    const folderSetting = new Setting(this.contentEl)
      .setName(t("LIBRARY_FOLDER_NAME"))
      .setDesc(t("LIBRARY_FOLDER_DESC"));
    const updateCreateFolderButton = (): void => {
      const path = folderText?.getValue().trim() ?? "";
      const folderExists = path
        ? Boolean(this.app.vault.getFolderByPath(normalizePath(path)))
        : false;
      if (createFolderButtonEl) {
        setElementHidden(createFolderButtonEl, !path || folderExists);
      }
    };
    folderSetting
      .addText((text: TextComponent) => {
        folderText = text;
        text.setValue(this.result.folderPath).onChange((value) => {
          this.result.folderPath = value;
          updateCreateFolderButton();
        });
        new VaultPathSuggest(this.app, text.inputEl, "folder");
        text.inputEl.addEventListener("input", updateCreateFolderButton);
        window.setTimeout(updateCreateFolderButton, 0);
      })
      .addButton((button) => {
        createFolderButtonEl = button.buttonEl;
        setElementHidden(button.buttonEl, true);
        button.setButtonText(t("CREATE_FOLDER")).onClick(async () => {
          await confirmAndCreateFolder(this.plugin, this.result.folderPath);
          updateCreateFolderButton();
        });
      });
    folderSetting.controlEl.addClass("excalidraw-folder-path-control");
    const createFolderRow = folderSetting.controlEl.createDiv({
      cls: "excalidraw-folder-create-row",
    });
    createFolderRow.appendChild(createFolderButtonEl);

    new Setting(this.contentEl)
      .setName(t("LIBRARY_FILE_NAME"))
      .setDesc(t("LIBRARY_FILE_DESC"))
      .addText((text) =>
        text.setValue(this.result.fileName).onChange((value) => {
          this.result.fileName = value;
        }),
      );

    const buttons = new Setting(this.contentEl);
    buttons.addButton((button) =>
      button
        .setButtonText(t("LIBRARY_MIGRATION_KEEP_DATA_JSON"))
        .onClick(() => {
          this.result.choice = "keep-data-json";
          this.close();
        }),
    );
    buttons.addButton((button) =>
      button.setButtonText(t("LIBRARY_MIGRATION_LATER")).onClick(() => {
        this.result.choice = "later";
        this.close();
      }),
    );
    buttons.addButton((button) =>
      button
        .setCta()
        .setButtonText(t("LIBRARY_MIGRATION_MIGRATE"))
        .onClick(() => {
          this.result.choice = "migrate";
          this.close();
        }),
    );
  }

  onClose(): void {
    // Closing via the title-bar button or Escape intentionally keeps the
    // default "later" choice and applies the same one-day snooze.
    this.contentEl.empty();
    this.resolvePromise?.(this.result);
  }
}
