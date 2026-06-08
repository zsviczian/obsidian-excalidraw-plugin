import { App, Modal, Notice, Setting } from "obsidian";
import type ExcalidrawPlugin from "../core/main";
import type { ExcalidrawExtrasAPI } from "@zsviczian/excalidraw-extras-api";
import { t } from "../lang/helpers";

const EXTRAS_PLUGIN_ID = "excalidraw-extras";

// Configure your required versions here for easy updates
const REQUIRED_EXTRAS_VERSIONS: Record<string, { min?: string; exact?: string }> = {
  mathjax: { min: "1.0.0" },
  mermaid: { exact: "1.0.0" },
  pdf: { min: "1.0.0" }
};

export class ExcalidrawExtrasGateway {
  private disableTimer: NodeJS.Timeout | null = null;
  // This promise tracks an ongoing activation to prevent duplicate modals
  private activationTask: Promise<boolean> | null = null;

  constructor(private app: App, private plugin: ExcalidrawPlugin) {}

  /**
   * Retrieves the MathJax module. If the plugin is missing/disabled/outdated,
   * it prompts the user automatically.
   */
  public async getMathJax(): Promise<ExcalidrawExtrasAPI["mathjax"] | null> {
    const api = await this.ensureActiveAndGetAPI("mathjax");
    return api ? api.mathjax : null;
  }

  // Future expansion is easy:
  // public async getMermaid() { const api = await this.ensureActiveAndGetAPI("mermaid"); return api?.mermaid; }

  private async ensureActiveAndGetAPI(component: string): Promise<ExcalidrawExtrasAPI | null> {
    // Access internal Obsidian plugin manager
    const pluginsManager = (this.app as any).plugins;
    const isInstalled = !!pluginsManager.manifests[EXTRAS_PLUGIN_ID];
    let isEnabled = !!pluginsManager.plugins[EXTRAS_PLUGIN_ID];

    // 1. If not installed or disabled, handle activation
    if (!isInstalled || !isEnabled) {
      // If an activation prompt is not already running, start one
      if (!this.activationTask) {
        this.activationTask = this.handleActivation(component).finally(() => {
          // Clean up the task once it's done so future calls can trigger a new prompt if needed
          this.activationTask = null;
        });
      }

      // Wait for the shared activation task to complete
      const activated = await this.activationTask;
      if (!activated) {
        return null; // User cancelled or chose "install"
      }
    }

    // 2. Plugin is active, retrieve API
    const api = pluginsManager.plugins[EXTRAS_PLUGIN_ID]?.api as ExcalidrawExtrasAPI;
    if (!api) {
      new Notice(t("EXTRAS_GATEWAY_API_MISSING"));
      return null;
    }

    // 3. Verify Version Match
    const currentVersion = api.versions[component as keyof typeof api.versions];
    const req = REQUIRED_EXTRAS_VERSIONS[component];
    
    if (req) {
      if (req.exact && currentVersion !== req.exact) {
        new Notice(`Excalidraw Extras Update Required. ${component} requires EXACTLY v${req.exact} (Found v${currentVersion})`);
        window.open(`obsidian://show-plugin?id=${EXTRAS_PLUGIN_ID}`);
        return null;
      }
      if (req.min && this.compareVersions(currentVersion, req.min) < 0) {
        new Notice(`Excalidraw Extras Update Required. ${component} requires >= v${req.min} (Found v${currentVersion})`);
        window.open(`obsidian://show-plugin?id=${EXTRAS_PLUGIN_ID}`);
        return null;
      }
    }

    return api;
  }

  /**
   * Extracted the activation logic into its own method so it can be wrapped in a shared Promise
   */
  private async handleActivation(component: string): Promise<boolean> {
    const pluginsManager = (this.app as any).plugins;
    const isInstalled = !!pluginsManager.manifests[EXTRAS_PLUGIN_ID];

    const userAction = await this.promptActivationModal(isInstalled, component);
    if (!userAction) return false; // User cancelled

    if (userAction === "install") {
      window.open(`obsidian://show-plugin?id=${EXTRAS_PLUGIN_ID}`);
      return false; 
    }

    if (userAction.startsWith("enable_")) {
      await pluginsManager.enablePlugin(EXTRAS_PLUGIN_ID);
      
      // Handle timer logic
      if (this.disableTimer) clearTimeout(this.disableTimer);
      if (userAction !== "enable_permanent") {
        const minutes = parseInt(userAction.split("_")[1]);
        this.disableTimer = setTimeout(async () => {
          await pluginsManager.disablePlugin(EXTRAS_PLUGIN_ID);
          new Notice(t("EXTRAS_GATEWAY_TIMER_EXPIRED"));
        }, minutes * 60 * 1000);
      }
      return true;
    }

    return false;
  }

  private compareVersions(v1: string, v2: string): number {
    const a = v1.split('.').map(Number);
    const b = v2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((a[i] || 0) > (b[i] || 0)) return 1;
      if ((a[i] || 0) < (b[i] || 0)) return -1;
    }
    return 0;
  }

  private promptActivationModal(isInstalled: boolean, component: string): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new ExtrasActivationModal(this.app, isInstalled, component, resolve);
      modal.open();
    });
  }
}

class ExtrasActivationModal extends Modal {
  constructor(
    app: App,
    private isInstalled: boolean,
    private component: string,
    private resolvePromise: (value: string | null) => void
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl("h2", { text: t("EXTRAS_GATEWAY_TITLE") });
    contentEl.createEl("p", { text: t("EXTRAS_GATEWAY_DESC").replace("{component}", this.component) });

    if (!this.isInstalled) {
      new Setting(contentEl)
        .addButton((btn) => btn.setButtonText(t("EXTRAS_GATEWAY_INSTALL_BTN")).setCta().onClick(() => {
          this.resolvePromise("install");
          this.close();
        }))
        .addButton((btn) => btn.setButtonText(t("BACKUP_CANCEL")).onClick(() => this.close()));
    } else {
      new Setting(contentEl)
        .addButton((btn) => btn.setButtonText(t("EXTRAS_GATEWAY_ENABLE_PERM_BTN")).setCta().onClick(() => {
          this.resolvePromise("enable_permanent");
          this.close();
        }));

      new Setting(contentEl)
        .setName(t("EXTRAS_GATEWAY_TEMP_ENABLE_TITLE"))
        .setDesc(t("EXTRAS_GATEWAY_TEMP_ENABLE_DESC"))
        .addButton((btn) => btn.setButtonText("5 min").onClick(() => { this.resolvePromise("enable_5"); this.close(); }))
        .addButton((btn) => btn.setButtonText("30 min").onClick(() => { this.resolvePromise("enable_30"); this.close(); }))
        .addButton((btn) => btn.setButtonText("1 hour").onClick(() => { this.resolvePromise("enable_60"); this.close(); }));
        
      new Setting(contentEl).addButton((btn) => btn.setButtonText(t("BACKUP_CANCEL")).onClick(() => this.close()));
    }
  }

  onClose() {
    this.contentEl.empty();
    // Resolve null if user clicked out or pressed escape without making a selection
    this.resolvePromise(null);
  }
}