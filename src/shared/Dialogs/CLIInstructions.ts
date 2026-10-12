import { App, ButtonComponent, Modal, Notice } from "obsidian";
import { t } from "src/lang/helpers";

/** A short prompt directing agents to the CLI documentation. */
export class CLIInstructions extends Modal {
  public constructor(app: App) { super(app); }
  public onOpen(): void {
    this.titleEl.setText(t("CLI_HELP"));
    const instructions = t("CLI_AGENT_INSTRUCTIONS");
    this.contentEl.createEl("pre").createEl("code", { text: instructions });
    const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
    new ButtonComponent(buttons).setButtonText(t("CLI_COPY_SKILL")).onClick(async () => {
      try { await this.contentEl.ownerDocument.defaultView.navigator.clipboard.writeText(instructions); }
      catch { new Notice(t("AI_USAGE_MODAL_COPY_FAILURE")); }
    });
  }
  public onClose(): void { this.contentEl.empty(); }
}
