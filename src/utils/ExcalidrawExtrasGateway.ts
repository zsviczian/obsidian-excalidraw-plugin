import { App, Modal, Notice, Setting } from "obsidian";
import type ExcalidrawPlugin from "../core/main";
import type {
  ExcalidrawExtrasAPI,
  ExtrasComponent,
} from "@zsviczian/excalidraw-extras-api";
import { t } from "../lang/helpers";
import en from "src/lang/locale/en";

const EXTRAS_PLUGIN_ID = "excalidraw-extras";

const REQUIRED_EXTRAS_VERSIONS: Record<
  string,
  { min?: string; exact?: string }
> = {
  plugin: { min: "0.0.13" },
  mathjax: { min: "1.0.0" },
  mermaid: { exact: "2.2.2" },
  pdf: { min: "1.0.0" },
  filesystem: { min: "1.0.0" },
};

type ActionResolution = "success" | "ignore" | "cancel";

export type VersionCheckResult = {
  valid: boolean;
  isExact?: boolean;
  compName?: string;
  reqVersion?: string;
  currentVersion?: string;
};

export class ExcalidrawExtrasGateway {
  private pluginDisableTimer: number | null = null;

  private ignoredComponents: Set<string> = new Set();
  private activationTask: Promise<ActionResolution> | null = null;

  constructor(
    public app: App,
    public plugin: ExcalidrawPlugin,
  ) {}

  public async getMathJax(): Promise<ExcalidrawExtrasAPI["mathjax"] | null> {
    const api = await this.ensureActiveAndGetAPI("mathjax");
    return api ? api.mathjax : null;
  }

  public async getExportToPDF(): Promise<ExcalidrawExtrasAPI["pdf"] | null> {
    const api = await this.ensureActiveAndGetAPI("pdf");
    return api ? api.pdf : null;
  }

  public async getMermaid(): Promise<ExcalidrawExtrasAPI["mermaid"] | null> {
    const api = await this.ensureActiveAndGetAPI("mermaid");
    return api ? api.mermaid : null;
  }

  public async getFileSystem(): Promise<
    ExcalidrawExtrasAPI["filesystem"] | null
  > {
    const api = await this.ensureActiveAndGetAPI("filesystem");
    return api ? api.filesystem : null;
  }

  private async ensureActiveAndGetAPI(
    component: ExtrasComponent,
  ): Promise<ExcalidrawExtrasAPI | null> {
    if (this.ignoredComponents.has(component)) {
      return null;
    }

    if (this.activationTask === null) {
      this.activationTask = (async () => {
        try {
          return await this.handleActivation(component);
        } finally {
          this.activationTask = null;
        }
      })();
    }

    const resolution = await this.activationTask;

    if (resolution === "ignore") {
      this.ignoredComponents.add(component);
      return null;
    }
    if (resolution === "cancel") {
      return null;
    }

    // At this point, we assume "success", retrieve API and verify versions
    const api = this.getAPI();
    if (!api) {
      return null;
    }

    if (!this.checkVersion(component, api).valid) {
      return null;
    }

    return api;
  }

  private async handleActivation(
    component: ExtrasComponent,
  ): Promise<ActionResolution> {
    // If everything is already perfect, return success immediately
    if (this.isInstalled() && this.isPluginEnabled()) {
      const api = this.getAPI();
      // Added version check to the success path so it opens the modal if an update is needed
      if (
        api &&
        api.features.isActive(component) &&
        this.checkVersion(component, api).valid
      ) {
        return "success";
      }
    }

    // Otherwise, open the progressive modal
    return new Promise((resolve) => {
      const modal = new ExtrasActivationModal(
        this.app,
        component,
        this,
        resolve,
      );
      modal.open();
    });
  }

  public isInstalled(): boolean {
    return !!this.app.plugins.manifests[EXTRAS_PLUGIN_ID];
  }

  public isPluginEnabled(): boolean {
    return !!this.app.plugins.plugins[EXTRAS_PLUGIN_ID];
  }

  public getAPI(): ExcalidrawExtrasAPI | null {
    return (
      (this.app.plugins.plugins[EXTRAS_PLUGIN_ID]
        ?.api as ExcalidrawExtrasAPI) || null
    );
  }

  public checkVersion(
    component: string,
    api: ExcalidrawExtrasAPI,
  ): VersionCheckResult {
    // 1. Check overall plugin version first
    const pluginReq = REQUIRED_EXTRAS_VERSIONS.plugin;
    if (pluginReq) {
      const manifest = this.app.plugins.manifests[EXTRAS_PLUGIN_ID];
      const pluginVersion = manifest?.version || "0.0.0";
      const pluginCompName = t("EXTRAS_GATEWAY_COMP_PLUGIN");

      if (pluginReq.exact && pluginVersion !== pluginReq.exact) {
        return {
          valid: false,
          isExact: true,
          compName: pluginCompName,
          reqVersion: pluginReq.exact,
          currentVersion: pluginVersion,
        };
      }
      if (
        pluginReq.min &&
        this.compareVersions(pluginVersion, pluginReq.min) < 0
      ) {
        return {
          valid: false,
          isExact: false,
          compName: pluginCompName,
          reqVersion: pluginReq.min,
          currentVersion: pluginVersion,
        };
      }
    }

    // 2. Check specific component version
    const currentVersion = api.versions[component as keyof typeof api.versions];
    const req = REQUIRED_EXTRAS_VERSIONS[component];
    if (!req) {
      return { valid: true };
    }

    const compName = t(
      `EXTRAS_GATEWAY_COMP_${component.toUpperCase()}` as keyof typeof en,
    );

    if (req.exact && currentVersion !== req.exact) {
      return {
        valid: false,
        isExact: true,
        compName,
        reqVersion: req.exact,
        currentVersion,
      };
    }
    if (req.min && this.compareVersions(currentVersion, req.min) < 0) {
      return {
        valid: false,
        isExact: false,
        compName,
        reqVersion: req.min,
        currentVersion,
      };
    }

    return { valid: true };
  }

  public async enablePlugin(minutes: number = 0) {
    await this.app.plugins.enablePlugin(EXTRAS_PLUGIN_ID);

    if (this.pluginDisableTimer) {
      window.clearTimeout(this.pluginDisableTimer);
    }
    if (minutes > 0) {
      this.pluginDisableTimer = window.setTimeout(
        () => {
          void (async () => {
            await this.app.plugins.disablePlugin(EXTRAS_PLUGIN_ID);
            new Notice(t("EXTRAS_GATEWAY_TIMER_EXPIRED"));
          })();
        },
        minutes * 60 * 1000,
      );
    }
  }

  public async enableFeature(
    component: ExtrasComponent,
    api: ExcalidrawExtrasAPI,
    minutes: number = 0,
  ) {
    await api.features.enable(component, minutes);
  }

  private compareVersions(v1: string, v2: string): number {
    const a = v1.split(".").map(Number);
    const b = v2.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if ((a[i] || 0) > (b[i] || 0)) {
        return 1;
      }
      if ((a[i] || 0) < (b[i] || 0)) {
        return -1;
      }
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
    private resolvePromise: (value: ActionResolution) => void,
  ) {
    super(app);
  }

  onOpen() {
    void this.renderStep();
  }

  async renderStep() {
    const { contentEl } = this;
    contentEl.empty();

    const compName = t(
      `EXTRAS_GATEWAY_COMP_${this.component.toUpperCase()}` as keyof typeof en,
    );

    // Step 1: Install Plugin
    if (!this.gateway.isInstalled()) {
      contentEl.createEl("h2", { text: t("EXTRAS_GATEWAY_TITLE") });
      contentEl.createEl("p", {
        text: t("EXTRAS_GATEWAY_DESC").replace("{component}", compName),
      });

      this.addControls(
        contentEl,
        () => {
          window.open(`obsidian://show-plugin?id=${EXTRAS_PLUGIN_ID}`);
          this.resolveAndClose("cancel");
        },
        t("EXTRAS_GATEWAY_INSTALL_BTN"),
      );
      return;
    }

    // Step 2: Enable Plugin
    if (this.gateway.isInstalled() && !this.gateway.isPluginEnabled()) {
      contentEl.createEl("h2", { text: t("EXTRAS_GATEWAY_TITLE") });
      contentEl.createEl("p", {
        text: t("EXTRAS_GATEWAY_DESC").replace("{component}", compName),
      });

      this.addControls(
        contentEl,
        (minutes) => {
          void (async () => {
            await this.gateway.enablePlugin(minutes);
            await this.renderStep(); // Re-evaluate state!
          })();
        },
        t("EXTRAS_GATEWAY_ENABLE_PERM_BTN"),
      );
      return;
    }

    // Step 3: API & Version Checks
    const api = this.gateway.getAPI();
    if (!api) {
      new Notice(t("EXTRAS_GATEWAY_API_MISSING"));
      this.resolveAndClose("cancel");
      return;
    }

    const versionCheck = this.gateway.checkVersion(this.component, api);
    if (!versionCheck.valid) {
      contentEl.createEl("h2", { text: t("EXTRAS_GATEWAY_UPDATE_TITLE") });

      const msg = t(
        versionCheck.isExact
          ? "EXTRAS_GATEWAY_UPDATE_EXACT"
          : "EXTRAS_GATEWAY_UPDATE_MIN",
      )
        .replace("{component}", versionCheck.compName)
        .replace("{reqVersion}", versionCheck.reqVersion)
        .replace("{currentVersion}", versionCheck.currentVersion);

      contentEl.createEl("p", { text: msg });

      new Setting(contentEl)
        .addButton((btn) =>
          btn
            .setButtonText(t("EXTRAS_GATEWAY_UPDATE_BTN"))
            .setCta()
            .onClick(() => {
              this.resolveAndClose("cancel");
              window.setTimeout(() => {
                window.open(`obsidian://show-plugin?id=${EXTRAS_PLUGIN_ID}`);
              }, 50);
            }),
        )
        .addButton((btn) =>
          btn
            .setButtonText(t("BACKUP_CANCEL"))
            .onClick(() => this.resolveAndClose("cancel")),
        );
      return;
    }

    // Step 4: Enable Specific Feature Setting
    if (!api.features.isActive(this.component)) {
      contentEl.createEl("h2", { text: t("EXTRAS_GATEWAY_FEATURE_TITLE") });
      contentEl.createEl("p", {
        text: t("EXTRAS_GATEWAY_FEATURE_DESC").replace("{component}", compName),
      });

      const featureBtnText = t(
        "EXTRAS_GATEWAY_ENABLE_FEATURE_PERM_BTN",
      ).replace("{component}", compName);

      this.addControls(
        contentEl,
        (minutes) => {
          void (async () => {
            await this.gateway.enableFeature(this.component, api, minutes);
            await this.renderStep(); // Re-evaluate state!
          })();
        },
        featureBtnText,
      );
      return;
    }

    // Final Step: Everything is active!
    this.resolveAndClose("success");
  }

  private addControls(
    container: HTMLElement,
    onEnable: (minutes: number) => void,
    permBtnText: string,
  ) {
    new Setting(container).addButton((btn) =>
      btn
        .setButtonText(permBtnText)
        .setCta()
        .onClick(() => onEnable(0)),
    );

    const isSessionOnly =
      this.component === "mathjax" || this.component === "mermaid";
    if (this.gateway.isInstalled() && this.gateway.isPluginEnabled()) {
      if (isSessionOnly) {
        new Setting(container)
          .setName(t("EXTRAS_GATEWAY_TEMP_ENABLE_TITLE"))
          .setDesc(t("EXTRAS_GATEWAY_SESSION_ENABLE_DESC"))
          .addButton((btn) =>
            btn
              .setButtonText(t("EXTRAS_GATEWAY_ENABLE_CURRENT_SESSION"))
              .onClick(() => onEnable(-1)),
          );
      } else {
        new Setting(container)
          .setName(t("EXTRAS_GATEWAY_TEMP_ENABLE_TITLE"))
          .setDesc(t("EXTRAS_GATEWAY_TEMP_ENABLE_DESC"))
          .addButton((btn) =>
            btn.setButtonText("5 Min").onClick(() => onEnable(5)),
          )
          .addButton((btn) =>
            btn.setButtonText("30 Min").onClick(() => onEnable(30)),
          )
          .addButton((btn) =>
            btn.setButtonText("1 Hour").onClick(() => onEnable(60)),
          );
      }
    }

    new Setting(container)
      .addButton((btn) =>
        btn
          .setButtonText(t("BACKUP_CANCEL"))
          .onClick(() => this.resolveAndClose("cancel")),
      )
      .addButton((btn) =>
        btn
          .setButtonText(t("EXTRAS_GATEWAY_IGNORE_SESSION"))
          .setWarning()
          .onClick(() => this.resolveAndClose("ignore")),
      );
  }

  private resolveAndClose(
    result: ActionResolution,
    shouldClose: boolean = true,
  ) {
    if (this.hasResolved) {
      return;
    }
    this.hasResolved = true;
    this.resolvePromise(result);
    if (shouldClose) {
      this.close();
    }
  }

  onClose() {
    this.contentEl.empty();
    if (!this.hasResolved) {
      this.resolveAndClose("cancel", false);
    }
  }
}
