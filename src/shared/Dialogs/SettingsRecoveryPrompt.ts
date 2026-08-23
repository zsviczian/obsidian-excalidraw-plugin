import { type App, Modal, Setting } from "obsidian";
import { t } from "src/lang/helpers";

export type SettingsRecoveryChoice =
  | "restore-recovery"
  | "reset-defaults"
  | "wait-for-file";

export type SettingsRecoveryPromptMode =
  | "missing-with-recovery"
  | "invalid-without-recovery";

/** Resolves ambiguous startup settings loss without silently choosing for the user. */
export class SettingsRecoveryPrompt extends Modal {
  private resolvePromise: (choice: SettingsRecoveryChoice) => void;
  private choice: SettingsRecoveryChoice;

  public constructor(
    app: App,
    private readonly mode: SettingsRecoveryPromptMode,
  ) {
    super(app);
    this.choice =
      mode === "missing-with-recovery"
        ? "restore-recovery"
        : "wait-for-file";
  }

  /** Opens the prompt and resolves after the user chooses or closes it. */
  public start(): Promise<SettingsRecoveryChoice> {
    const result = new Promise<SettingsRecoveryChoice>((resolve) => {
      this.resolvePromise = resolve;
    });
    this.open();
    return result;
  }

  public onOpen(): void {
    const hasRecovery = this.mode === "missing-with-recovery";
    this.titleEl.setText(
      t(
        hasRecovery
          ? "SETTINGS_RECOVERY_MISSING_TITLE"
          : "SETTINGS_RECOVERY_CORRUPT_TITLE",
      ),
    );
    this.contentEl.createEl("p", {
      text: t(
        hasRecovery
          ? "SETTINGS_RECOVERY_MISSING_DESC"
          : "SETTINGS_RECOVERY_CORRUPT_DESC",
      ),
    });

    const buttons = new Setting(this.contentEl);
    buttons.addButton((button) =>
      button
        .setButtonText(t("SETTINGS_RECOVERY_RESET_DEFAULTS"))
        .onClick(() => {
          this.choice = "reset-defaults";
          this.close();
        }),
    );
    buttons.addButton((button) =>
      button
        .setCta()
        .setButtonText(
          t(
            hasRecovery
              ? "SETTINGS_RECOVERY_RESTORE_BACKUP"
              : "SETTINGS_RECOVERY_WAIT_FOR_FILE",
          ),
        )
        .onClick(() => {
          this.choice = hasRecovery ? "restore-recovery" : "wait-for-file";
          this.close();
        }),
    );
  }

  public onClose(): void {
    this.contentEl.empty();
    this.resolvePromise?.(this.choice);
  }
}
