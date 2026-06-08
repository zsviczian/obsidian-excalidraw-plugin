import { App, Modal, Notice, Setting } from "obsidian";
import type ExcalidrawPlugin from "../core/main";
import type { ExcalidrawExtrasAPI, ExtrasComponent } from "@zsviczian/excalidraw-extras-api";
import { t } from "../lang/helpers";

const EXTRAS_PLUGIN_ID = "excalidraw-extras";

const REQUIRED_EXTRAS_VERSIONS: Record<string, { min?: string; exact?: string }> = {
  mathjax: { min: "1.0.0" },
  mermaid: { exact: "1.0.0" },
  pdf: { min: "1.0.0" }
};

type ActionResolution = "success" | "ignore" | "cancel";

export class ExcalidrawExtrasGateway {
  private pluginDisableTimer: NodeJS.Timeout | null = null;
  private featureDisableTimers: Record<string, NodeJS.Timeout> = {};
  
  private ignoredComponents: Set<string> = new Set();
  private activationTask: Promise<ActionResolution> | null = null;

  constructor(public app: App, public plugin: ExcalidrawPlugin) {}

  public async getMathJax(): Promise<ExcalidrawExtrasAPI["mathjax"] | null> {
    const api = await this.ensureActiveAndGetAPI("mathjax");
    return api ? api.mathjax : null;
  }

  public async getExportToPDF(): Promise<ExcalidrawExtrasAPI["pdf"] | null> {
    const api = await this.ensureActiveAndGetAPI("pdf");
    return api ? api.pdf : null;
  }

  private async ensureActiveAndGetAPI(component: ExtrasComponent): Promise<ExcalidrawExtrasAPI | null> {
    if (this.ignoredComponents.has(component)) return null;

    if (!this.activationTask) {
      this.activationTask = this.handleActivation(component).finally(() => {
        this.activationTask = null; // Clear shared task for future triggers
      });
    }

    const resolution = await this.activationTask;
    
    if (resolution === "ignore") {
      this.ignoredComponents.add(component);
      return null;
    }
    if (resolution === "cancel") return null;

    // At this point, we assume "success", retrieve API and verify versions
    const api = this.getAPI();
    if (!api) return null;

    if (!this.isVersionValid(component, api)) return null;

    return api;
  }

  private async handleActivation(component: ExtrasComponent): Promise<ActionResolution> {
    // If everything is already perfect, return success immediately
    if (this.isInstalled() && this.isPluginEnabled()) {
      const api = this.getAPI();
      if (api && api.features.isActive(component)) return "success";
    }

    // Otherwise, open the progressive modal
    return new Promise((resolve) => {
      const modal = new ExtrasActivationModal(this.app, component, this, resolve);
      modal.open();
    });
  }

  public isInstalled(): boolean {
    return !!(this.app as any).plugins.manifests[EXTRAS_PLUGIN_ID];
  }

  public isPluginEnabled(): boolean {
    return !!(this.app as any).plugins.plugins[EXTRAS_PLUGIN_ID];
  }

  public getAPI(): ExcalidrawExtrasAPI | null {
    return (this.app as any).plugins.plugins[EXTRAS_PLUGIN_ID]?.api || null;
  }

  public isVersionValid(component: string, api: ExcalidrawExtrasAPI): boolean {
    const currentVersion = api.versions[component as keyof typeof api.versions];
    const req = REQUIRED_EXTRAS_VERSIONS[component];
    if (!req) return true;

    if (req.exact && currentVersion !== req.exact) {
      new Notice(`Excalidraw Extras Update Required. ${component} requires EXACTLY v${req.exact} (Found v${currentVersion})`);
      window.open(`obsidian://show-plugin?id=${EXTRAS_PLUGIN_ID}`);
      return false;
    }
    if (req.min && this.compareVersions(currentVersion, req.min) < 0) {
      new Notice(`Excalidraw Extras Update Required. ${component} requires >= v${req.min} (Found v${currentVersion})`);
      window.open(`obsidian://show-plugin?id=${EXTRAS_PLUGIN_ID}`);
      return false;
    }
    return true;
  }

  public async enablePlugin(minutes: number = 0) {
    const pluginsManager = (this.app as any).plugins;
    await pluginsManager.enablePlugin(EXTRAS_PLUGIN_ID);
    
    if (this.pluginDisableTimer) clearTimeout(this.pluginDisableTimer);
    if (minutes > 0) {
      this.pluginDisableTimer = setTimeout(async () => {
        await pluginsManager.disablePlugin(EXTRAS_PLUGIN_ID);
        new Notice(t("EXTRAS_GATEWAY_TIMER_EXPIRED"));
      }, minutes * 60 * 1000);
    }
  }

  public async enableFeature(component: ExtrasComponent, api: ExcalidrawExtrasAPI, minutes: number = 0) {
    const isTemp = minutes > 0;
    await api.features.enable(component, isTemp);
    
    if (this.featureDisableTimers[component]) clearTimeout(this.featureDisableTimers[component]);
    if (isTemp) {
      this.featureDisableTimers[component] = setTimeout(async () => {
        await api.features.disable(component);
        new Notice(t("EXTRAS_GATEWAY_FEATURE_TIMER_EXPIRED").replace("{component}", component));
      }, minutes * 60 * 1000);
    }
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
}

/**
 * A progressive state-machine Modal. It checks the environment every time it renders.
 * If you enable the plugin, it re-renders and moves seamlessly to the "Enable Feature" step if needed.
 */
class ExtrasActivationModal extends Modal {
  private hasResolved = false;

  constructor(
    app: App,
    private component: ExtrasComponent,
    private gateway: ExcalidrawExtrasGateway,
    private resolvePromise: (value: ActionResolution) => void
  ) {
    super(app);
  }

  onOpen() {
    this.renderStep();
  }

  async renderStep() {
    const { contentEl } = this;
    contentEl.empty();
    
    // Step 1: Install Plugin
    if (!this.gateway.isInstalled()) {
      contentEl.createEl("h2", { text: t("EXTRAS_GATEWAY_TITLE") });
      contentEl.createEl("p", { text: t("EXTRAS_GATEWAY_DESC").replace("{component}", this.component) });
      
      this.addControls(contentEl, () => {
        window.open(`obsidian://show-plugin?id=${EXTRAS_PLUGIN_ID}`);
        this.resolveAndClose("cancel");
      }, t("EXTRAS_GATEWAY_INSTALL_BTN"));
      return;
    }

    // Step 2: Enable Plugin
    if (!this.gateway.isPluginEnabled()) {
      contentEl.createEl("h2", { text: t("EXTRAS_GATEWAY_TITLE") });
      contentEl.createEl("p", { text: t("EXTRAS_GATEWAY_DESC").replace("{component}", this.component) });
      
      this.addControls(contentEl, async (minutes) => {
        await this.gateway.enablePlugin(minutes);
        this.renderStep(); // Re-evaluate state!
      }, t("EXTRAS_GATEWAY_ENABLE_PERM_BTN"));
      return;
    }

    // Step 3: API & Version Checks
    const api = this.gateway.getAPI();
    if (!api) {
      new Notice(t("EXTRAS_GATEWAY_API_MISSING"));
      this.resolveAndClose("cancel");
      return;
    }

    if (!this.gateway.isVersionValid(this.component, api)) {
      this.resolveAndClose("cancel");
      return;
    }

    // Step 4: Enable Specific Feature Setting
    if (!api.features.isActive(this.component)) {
      contentEl.createEl("h2", { text: t("EXTRAS_GATEWAY_FEATURE_TITLE").replace("{component}", this.component) });
      contentEl.createEl("p", { text: t("EXTRAS_GATEWAY_FEATURE_DESC").replace("{component}", this.component) });
      
      this.addControls(contentEl, async (minutes) => {
        await this.gateway.enableFeature(this.component, api, minutes);
        this.renderStep(); // Re-evaluate state!
      }, t("EXTRAS_GATEWAY_ENABLE_PERM_BTN"));
      return;
    }

    // Final Step: Everything is active!
    this.resolveAndClose("success");
  }

  private addControls(container: HTMLElement, onEnable: (minutes: number) => void, permBtnText: string) {
    new Setting(container)
      .addButton((btn) => btn.setButtonText(permBtnText).setCta().onClick(() => onEnable(0)));

    new Setting(container)
      .setName(t("EXTRAS_GATEWAY_TEMP_ENABLE_TITLE"))
      .setDesc(t("EXTRAS_GATEWAY_TEMP_ENABLE_DESC"))
      .addButton((btn) => btn.setButtonText("5 min").onClick(() => onEnable(5)))
      .addButton((btn) => btn.setButtonText("30 min").onClick(() => onEnable(30)))
      .addButton((btn) => btn.setButtonText("1 hour").onClick(() => onEnable(60)));
      
    new Setting(container)
      .addButton((btn) => btn.setButtonText(t("BACKUP_CANCEL")).onClick(() => this.resolveAndClose("cancel")))
      .addButton((btn) => btn.setButtonText(t("EXTRAS_GATEWAY_IGNORE_SESSION")).setWarning().onClick(() => this.resolveAndClose("ignore")));
  }

  private resolveAndClose(result: ActionResolution) {
    if (this.hasResolved) return;
    this.hasResolved = true;
    this.resolvePromise(result);
    this.close();
  }

  onClose() {
    this.contentEl.empty();
    // Catch-all if they dismiss the modal by clicking outside or hitting Escape
    if (!this.hasResolved) {
      this.resolveAndClose("cancel");
    }
  }
}