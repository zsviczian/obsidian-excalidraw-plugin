import { Modal, Setting } from "obsidian";
import ExcalidrawPlugin from "src/core/main";
import { t } from "src/lang/helpers";
import { fragWithHTML } from "src/utils/utils";

/**
 * Lists every script that has ever called `ExcalidrawAutomate.
 * registerAutostart()` (i.e. the user ran it at least once), each with an
 * editable Autostart / Manual start only / Ask every time control (reusing
 * the exact same labels as the permission prompt's buttons, so the two
 * surfaces speak one consistent vocabulary), and a warning if the script's
 * most recent autostart run failed (`settings.autostartScriptFailures`,
 * purely informational - it never changes the script's setting on its
 * own). A "Manual start only" (deny) decision is not a dead end: it can be
 * switched straight back to Autostart or Ask every time from here, without
 * needing to re-run the script to get prompted again.
 *
 * Rendered as a bordered table (header row + one row per script), reusing
 * the AI provider table's existing `.excalidraw-ai-provider-table` CSS (see
 * `renderAISettings()` in `settings.ts`) rather than adding near-duplicate
 * rules to `styles.css`, and rather than a foldable `<details>` section,
 * since this is a short, flat list rather than a large collapsible
 * settings group. Rendered both inline in Settings (under the Startup
 * script setting, in the ExcalidrawAutomate section) and inside
 * `AutostartScriptsModal` for the Command Palette entry point, matching
 * how `EmbeddalbeMDFileCustomDataSettingsComponent` is reused across
 * contexts.
 */
export class AutostartScriptsSettingsComponent {
  constructor(
    private contentEl: HTMLElement,
    private plugin: ExcalidrawPlugin,
  ) {}

  render(): void {
    this.contentEl.empty();
    this.contentEl.addClass("excalidraw-ai-provider-table");

    const autostartScripts = this.plugin.settings.autostartScripts;
    const scriptNames = Object.keys(autostartScripts).sort();

    const headerSetting = new Setting(this.contentEl)
      .setName(t("AUTOSTART_SCRIPTS_HEAD"))
      .setDesc(fragWithHTML(t("AUTOSTART_SCRIPTS_DESC")));
    headerSetting.settingEl.addClass("excalidraw-ai-provider-table__header");

    if (scriptNames.length === 0) {
      const emptyRow = new Setting(this.contentEl).setDesc(
        t("AUTOSTART_SCRIPTS_EMPTY"),
      );
      emptyRow.settingEl.addClass("excalidraw-ai-provider-table__row");
      return;
    }

    scriptNames.forEach((scriptName) => {
      const rowSetting = new Setting(this.contentEl)
        .setName(scriptName)
        .addDropdown((dropdown) =>
          dropdown
            .addOption("allow", t("AUTOSTART_SCRIPT_ALLOW"))
            .addOption("deny", t("AUTOSTART_SCRIPT_DENY"))
            .addOption("unknown", t("AUTOSTART_SCRIPT_ASK_LATER"))
            .setValue(autostartScripts[scriptName])
            .onChange(async (value) => {
              autostartScripts[scriptName] = value as
                | "allow"
                | "deny"
                | "unknown";
              await this.plugin.saveSettings();
            }),
        );
      rowSetting.settingEl.addClass("excalidraw-ai-provider-table__row");

      if (this.plugin.settings.autostartScriptFailures[scriptName]) {
        rowSetting.setDesc(
          fragWithHTML(
            `<span style="color: var(--text-error);">${t("AUTOSTART_SCRIPT_FAILED_WARNING")}</span>`,
          ),
        );
      }
    });
  }
}

export class AutostartScriptsModal extends Modal {
  constructor(private plugin: ExcalidrawPlugin) {
    super(plugin.app);
  }

  onOpen(): void {
    this.titleEl.setText(t("AUTOSTART_SCRIPTS_HEAD"));
    new AutostartScriptsSettingsComponent(
      this.contentEl,
      this.plugin,
    ).render();

    new Setting(this.contentEl).addButton((button) =>
      button.setButtonText(t("PROMPT_BUTTON_CLOSE")).onClick(() => this.close()),
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
