import { Modal, Setting } from "obsidian";
import ExcalidrawPlugin from "src/core/main";
import { t } from "src/lang/helpers";

declare const PLUGIN_VERSION: string;

/**
 * A modal dialog that informs the user about a version mismatch between the version recorded by Obsidian and the actual version of the plugin executable.
 * Explain that this can be the result of a partial sync, such as an Obsidian Sync Standard plan, which does not syncronize files larger than 5MB, and the plugin executable is larger.
 * Explain that changing the plugin version information in Obsidian can lead to unexpected behavior in plugins suchs as the Plugin Update Tracker plugin or the BRAT plugin. 
 * The user has a toggle button to disable this check in the future. There is additional information that this can be reenabled in plugin settings.
 * The user can click update obsidian version info to match the plugin version, and open Obsidian settings to redownload the plugin.
 * The user can click ignore to dismiss the dialog.
 */
export class VersionMismatchPrompt extends Modal {
  private resolvePromise: (value: any) => void;
  public promise: Promise<any>;
  private resolved: boolean;
  private isDirty: boolean = false;

  public constructor(
    private plugin: ExcalidrawPlugin,
  ) {
    super(plugin.app);
  }

  async start(): Promise<any> {
    this.promise = new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
    await this.plugin.loadSettings();
    this.buildUI();
    this.open();
    return this.promise;
  }

  private buildUI() {
    const { contentEl } = this;
    contentEl.empty();
    const recorded = this.plugin.manifest.version;
    const actual = PLUGIN_VERSION;

    contentEl.createEl("h2", { text: t("VERSION_MISMATCH_HEADING") });
    const p1 = contentEl.createEl("p");
    p1.innerHTML = t("VERSION_MISMATCH_NOTICE")
      .replace("{VAL_RECORDED}", recorded)
      .replace("{VAL_ACTUAL}", actual);

    const p2 = contentEl.createEl("p");
    p2.innerHTML = t("VERSION_MISMATCH_CAUSE");

    const p3 = contentEl.createEl("p");
    p3.innerHTML = t("VERSION_MISMATCH_OPTIONS");

    const p4 = contentEl.createEl("p");
    p4.innerHTML = t("VERSION_MISMATCH_NOTE");

    new Setting(contentEl)
      .setName(t("VERSION_MISMATCH_DISABLE_NAME"))
      .setDesc(t("VERSION_MISMATCH_DISABLE_DESC"))
      .addToggle(tg =>
        tg.setValue(!this.plugin.settings.compareManifestToPluginVersion ? true : false)
          .onChange(async (value) => {
            this.plugin.settings.compareManifestToPluginVersion = !value; // invert because label is Disable ...
            this.isDirty = true;
          }),
      );

    // Buttons row
    const buttonBar = contentEl.createDiv({ cls: "ex-version-mismatch-buttons" });

    const redownloadBtn = buttonBar.createEl("button", { text: t("VERSION_MISMATCH_REDOWNLOAD") });
    redownloadBtn.addEventListener("click", () => {
      this.resolved = true; // triggers opening settings in caller
      this.close();
    });

    const ignoreBtn = buttonBar.createEl("button", { text: t("VERSION_MISMATCH_IGNORE") });
    ignoreBtn.addEventListener("click", () => {
      this.resolved = false;
      this.close();
    });

    buttonBar.style.display = "flex";
    buttonBar.style.gap = "0.5rem";
    buttonBar.style.marginTop = "1rem";
    redownloadBtn.style.backgroundColor = "var(--interactive-accent)";
    redownloadBtn.style.color = "var(--text-on-accent)";
  }

  async onClose() {
    super.onClose();
    if(this.isDirty) {
      await this.plugin.saveSettings();
    }
    if (!this.resolved) {
      this.resolvePromise && this.resolvePromise(false);
    } else {
      this.resolvePromise && this.resolvePromise(true);
    }
  }
}