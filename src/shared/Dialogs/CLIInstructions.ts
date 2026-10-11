import { App, Modal, Notice, Setting } from "obsidian";
import { t } from "src/lang/helpers";
import { CLI_SKILL } from "src/core/cli/cliCommands";

/** Human discovery for the same offline instructions exposed by the native CLI. */
export class CLIInstructions extends Modal {
  public constructor(app: App) { super(app); }
  public onOpen(): void {
    this.titleEl.setText(t("CLI_HELP"));
    this.contentEl.createEl("pre").createEl("code", { text: CLI_SKILL });
    new Setting(this.contentEl).addButton(button => button.setButtonText(t("CLI_COPY_SKILL")).onClick(async () => {
      try { await this.contentEl.ownerDocument.defaultView.navigator.clipboard.writeText(CLI_SKILL); }
      catch { new Notice(t("AI_USAGE_MODAL_COPY_FAILURE")); }
    }));
  }
  public onClose(): void { this.contentEl.empty(); }
}
