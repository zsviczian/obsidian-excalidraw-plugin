import { App, ButtonComponent, Modal, Notice, type TFile } from "obsidian";
import type ExcalidrawPlugin from "src/core/main";
import { t } from "src/lang/helpers";
import { MultiOptionConfirmationPrompt } from "./Prompt";

type DrawingLoadFile = Readonly<Pick<TFile, "name" | "path">>;

/** Keep long filenames readable without splitting a Unicode code point. */
function warningTitle(file: DrawingLoadFile): string {
  const characters = Array.from(file.name);
  const name = characters.length > 80
    ? `${characters.slice(0, 54).join("")}…${characters.slice(-25).join("")}`
    : file.name;
  return t("DRAWING_LOAD_ERROR_TITLE").replace("{filename}", () => name);
}

/** Read-only explanation of a drawing load failure; never attempts a repair. */
export class DrawingLoadErrorInfo extends Modal {
  public constructor(
    app: App,
    private readonly file: DrawingLoadFile,
    private readonly error: unknown,
  ) {
    super(app);
  }

  public onOpen(): void {
    this.titleEl.setText(warningTitle(this.file));
    this.contentEl.createEl("p", { text: this.file.path });
    for (const paragraph of t("DRAWING_LOAD_ERROR_DETAILS").split("\n\n")) {
      this.contentEl.createEl("p", { text: paragraph });
    }
    // Parser messages and paths can contain file content or markup. Render
    // them only as text, and do not infer a sync/recovery diagnosis from them.
    const message = typeof this.error === "string"
      ? this.error
      : this.error && typeof this.error === "object" && "message" in this.error &&
        typeof this.error.message === "string" ? this.error.message : "";
    if (message) {
      this.contentEl.createEl("p", { text: t("DRAWING_LOAD_ERROR_REPORTED_ERROR") });
      this.contentEl.createEl("pre", { cls: "excalidraw-drawing-load-error-message" })
        .createEl("code", { text: message });
    }
    new ButtonComponent(this.contentEl.createDiv({ cls: "modal-button-container" }))
      .setButtonText(t("PROMPT_BUTTON_CLOSE"))
      .onClick(() => this.close());
  }

  public onClose(): void {
    this.contentEl.empty();
  }
}

/**
 * Adds file-specific context to an existing backup confirmation without changing
 * its buttons, selected value, keyboard default, or close promise.
 */
export function createDrawingLoadErrorPrompt(
  plugin: ExcalidrawPlugin,
  file: DrawingLoadFile,
  message: string,
  error: unknown,
): MultiOptionConfirmationPrompt {
  const target = { name: file.name, path: file.path };
  const prompt = new MultiOptionConfirmationPrompt(plugin, message);
  prompt.titleEl.setText(warningTitle(target));
  new ButtonComponent(prompt.contentEl.createDiv({ cls: "modal-button-container" }))
    .setButtonText(t("DRAWING_LOAD_ERROR_MORE_INFO"))
    .onClick(() => new DrawingLoadErrorInfo(plugin.app, target, error).open());
  return prompt;
}

/**
 * Shows the existing non-blocking no-backup warning with optional read-only
 * details. The caller retains ownership of the existing Markdown fallback.
 */
export function showDrawingLoadErrorNotice(
  app: App,
  file: DrawingLoadFile,
  error: unknown,
): void {
  const target = { name: file.name, path: file.path };
  const content = createFragment();
  content.createEl("strong", { text: warningTitle(target) });
  content.createEl("p", { text: t("DRAWING_LOAD_ERROR_MESSAGE") });
  content.createEl("p", { text: t("DRAWING_LOAD_ERROR_NO_BACKUP") });
  const buttons = content.createDiv({ cls: "excalidraw-drawing-load-error-buttons" });
  new ButtonComponent(buttons)
    .setButtonText(t("DRAWING_LOAD_ERROR_MORE_INFO"))
    .onClick(() => new DrawingLoadErrorInfo(app, target, error).open());
  new ButtonComponent(buttons)
    .setButtonText(t("DRAWING_LOAD_ERROR_DISMISS"))
    .onClick(() => notice.hide());
  const notice = new Notice(content, 10000);
}
