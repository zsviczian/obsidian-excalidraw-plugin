import { Notice, type App, type PluginManifest } from "obsidian";
import { JSON_parse } from "src/constants/constants";
import {
  DEFAULT_SETTINGS,
  type ExcalidrawSettings,
} from "src/core/settingsDefaults";
import { PreviewImageType } from "src/types/utilTypes";
import {
  decryptPersistedAPIKeys,
  encryptPersistedAPIKeys,
} from "src/utils/settingsKeyObfuscation";
import { SerializedSettingsWriter } from "src/core/settings/SerializedSettingsWriter";
import { SettingsRecoveryStore } from "src/core/settings/SettingsRecoveryStore";
import {
  SettingsRecoveryPrompt,
  type SettingsRecoveryChoice,
  type SettingsRecoveryPromptMode,
} from "src/shared/Dialogs/SettingsRecoveryPrompt";
import {
  classifySettingsDataLoad,
  isSettingsDataRecord,
  type SettingsDataFileState,
} from "src/core/settings/settingsDataValidation";
import { t } from "src/lang/helpers";

type PersistedExcalidrawSettings = Partial<ExcalidrawSettings> &
  Record<string, unknown>;

interface PluginSettingsHost {
  app: App;
  manifest: PluginManifest;
  settings: ExcalidrawSettings;
  loadData(): Promise<unknown>;
  saveData(data: unknown): Promise<void>;
}

interface SettingsRecoveryStoreLike {
  load(): Promise<PersistedExcalidrawSettings | null>;
  save(settings: PersistedExcalidrawSettings): Promise<void>;
  destroy(): void;
}

type SettingsRecoveryPromptHandler = (
  mode: SettingsRecoveryPromptMode,
) => Promise<SettingsRecoveryChoice>;

/**
 * Owns plugin settings persistence, default assembly, and compatibility
 * migrations while leaving startup readiness and settings UI registration to
 * the plugin lifecycle.
 */
export class PluginSettingsManager {
  private readonly writer: SerializedSettingsWriter<PersistedExcalidrawSettings>;
  private readonly recoveryStore: SettingsRecoveryStoreLike;
  private hasCompletedInitialLoad = false;
  private persistenceBlockedByInvalidData = false;
  private missingRecoveryNoticeShown = false;
  private awaitingStartupRecoveryChoice = false;
  private readonly promptForRecoveryChoice: SettingsRecoveryPromptHandler;

  public constructor(
    private readonly host: PluginSettingsHost,
    recoveryStore?: SettingsRecoveryStoreLike,
    promptForRecoveryChoice?: SettingsRecoveryPromptHandler,
  ) {
    this.recoveryStore =
      recoveryStore ??
      new SettingsRecoveryStore({
        databaseName: `Excalidraw Settings Recovery ${host.app.appId}`,
      });
    this.promptForRecoveryChoice =
      promptForRecoveryChoice ??
      ((mode) => new SettingsRecoveryPrompt(host.app, mode).start());
    this.writer = new SerializedSettingsWriter({
      saveData: async (data) => {
        await this.saveRecoverySnapshot(data);
        await this.host.saveData(data);
      },
    });
  }

  /**
   * Loads persisted settings, applies defaults and migrations, and decrypts
   * protected API-key fields.
   *
   * @remarks Unknown persisted properties are intentionally retained.
   * @returns `false` when the disk payload was invalid. Runtime callers use
   * this to suppress cache invalidation for a rejected synchronized payload.
   */
  public async loadSettings(): Promise<boolean> {
    const dataFileState = await this.getSettingsDataFileState();
    let loadedSettings: unknown = null;
    let loadFailed = false;
    try {
      loadedSettings = await this.host.loadData();
    } catch {
      loadFailed = true;
    }

    const classification = classifySettingsDataLoad({
      value: loadedSettings,
      fileState: dataFileState,
      loadFailed,
      isInitialLoad: !this.hasCompletedInitialLoad,
    });
    const hasInvalidSettings = classification === "invalid";
    const isFirstInstallation = classification === "first-installation";
    let persistedSettings: PersistedExcalidrawSettings;
    let recoveredInvalidStartup = false;
    let shouldPersistStartupChoice = false;

    if (hasInvalidSettings) {
      if (this.hasCompletedInitialLoad) {
        this.persistenceBlockedByInvalidData = false;
        this.missingRecoveryNoticeShown = false;
        new Notice(t("SETTINGS_DATA_REPAIRED_FROM_MEMORY"), 12000);
        console.error(
          "Excalidraw rejected invalid synchronized settings data and restored the active settings",
        );
        await this.persistSnapshot(
          encryptPersistedAPIKeys(
            this.host.settings as PersistedExcalidrawSettings,
          ),
        );
        return false;
      }
      const recoveredSettings = await this.loadRecoverySnapshot();
      if (recoveredSettings) {
        persistedSettings = recoveredSettings;
        recoveredInvalidStartup = true;
        shouldPersistStartupChoice = true;
        this.persistenceBlockedByInvalidData = false;
        this.missingRecoveryNoticeShown = false;
      } else {
        this.host.settings = Object.assign({}, DEFAULT_SETTINGS);
        const choice = await this.requestStartupRecoveryChoice(
          "invalid-without-recovery",
        );
        persistedSettings = {};
        if (choice === "reset-defaults") {
          this.persistenceBlockedByInvalidData = false;
          this.missingRecoveryNoticeShown = false;
          shouldPersistStartupChoice = true;
        } else {
          this.blockPersistenceWhileWaitingForFile();
        }
      }
    } else if (isFirstInstallation) {
      const recoveredSettings = await this.loadRecoverySnapshot();
      if (recoveredSettings) {
        this.host.settings = Object.assign({}, DEFAULT_SETTINGS);
        const choice = await this.requestStartupRecoveryChoice(
          "missing-with-recovery",
        );
        persistedSettings =
          choice === "reset-defaults" ? {} : recoveredSettings;
      } else {
        persistedSettings = {};
      }
      this.persistenceBlockedByInvalidData = false;
      this.missingRecoveryNoticeShown = false;
      shouldPersistStartupChoice = true;
    } else {
      this.persistenceBlockedByInvalidData = false;
      this.missingRecoveryNoticeShown = false;
      persistedSettings = isSettingsDataRecord(loadedSettings)
        ? loadedSettings
        : {};
    }

    const decryptedSettings = decryptPersistedAPIKeys(persistedSettings);
    let didSettingsMigration = false;
    this.host.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      decryptedSettings,
    );
    if (typeof decryptedSettings.libraryStorageMode === "undefined") {
      const legacyLibrary: unknown =
        typeof decryptedSettings.library === "string" &&
        decryptedSettings.library !== "" &&
        decryptedSettings.library !== "deprecated"
          ? JSON_parse(decryptedSettings.library)
          : decryptedSettings.library2;
      const legacyLibraryRecord =
        typeof legacyLibrary === "object" && legacyLibrary !== null
          ? (legacyLibrary as Record<string, unknown>)
          : null;
      const hasLegacyItems = Boolean(
        (Array.isArray(legacyLibraryRecord?.library) &&
          legacyLibraryRecord.library.length) ||
          (Array.isArray(legacyLibraryRecord?.libraryItems) &&
            legacyLibraryRecord.libraryItems.length),
      );
      this.host.settings.libraryStorageMode = hasLegacyItems
        ? "data-json"
        : "vault";
      this.host.settings.libraryMigrationStatus = hasLegacyItems
        ? "pending"
        : "not-required";
      didSettingsMigration = true;
    }
    const savedMarkdownImageSettings = decryptedSettings.markdownImageSettings;
    if (!savedMarkdownImageSettings) {
      this.host.settings.markdownImageSettings = {
        defaults: {
          ...DEFAULT_SETTINGS.markdownImageSettings.defaults,
          width: this.host.settings.mdSVGwidth,
          fontFamily: this.host.settings.mdFont,
          fontColor: this.host.settings.mdFontColor ?? "#000000",
          border: {
            enabled: false,
            color: this.host.settings.mdBorderColor,
          },
          css: "",
          transclusion: {
            ...DEFAULT_SETTINGS.markdownImageSettings.defaults.transclusion,
            border: {
              ...DEFAULT_SETTINGS.markdownImageSettings.defaults.transclusion
                .border,
            },
          },
        },
      };
      didSettingsMigration = true;
    } else {
      this.host.settings.markdownImageSettings = {
        defaults: {
          ...DEFAULT_SETTINGS.markdownImageSettings.defaults,
          ...savedMarkdownImageSettings.defaults,
          border: {
            ...DEFAULT_SETTINGS.markdownImageSettings.defaults.border,
            ...savedMarkdownImageSettings.defaults?.border,
          },
          transclusion: {
            ...DEFAULT_SETTINGS.markdownImageSettings.defaults.transclusion,
            ...savedMarkdownImageSettings.defaults?.transclusion,
            border: {
              ...DEFAULT_SETTINGS.markdownImageSettings.defaults.transclusion
                .border,
              ...savedMarkdownImageSettings.defaults?.transclusion?.border,
            },
          },
        },
      };
    }
    const markdownImageDefaults = this.host.settings.markdownImageSettings
      .defaults as unknown as Record<string, unknown>;
    if ("theme" in markdownImageDefaults) {
      delete markdownImageDefaults.theme;
      didSettingsMigration = true;
    }
    const settingsRecord = this.host.settings as unknown as Record<
      string,
      unknown
    >;
    if (
      typeof settingsRecord.iframelyAllowed === "boolean" &&
      typeof this.host.settings.oEmbedAllowed !== "boolean"
    ) {
      this.host.settings.oEmbedAllowed = settingsRecord.iframelyAllowed;
      didSettingsMigration = true;
    }
    if ("iframelyAllowed" in settingsRecord) {
      delete settingsRecord.iframelyAllowed;
      didSettingsMigration = true;
    }
    if (!this.host.settings.previewImageType) {
      // Migration introduced in 1.9.13.
      if (typeof this.host.settings.displaySVGInPreview === "undefined") {
        this.host.settings.previewImageType = PreviewImageType.SVGIMG;
      } else {
        this.host.settings.previewImageType = this.host.settings
          .displaySVGInPreview
          ? PreviewImageType.SVGIMG
          : PreviewImageType.PNG;
      }
    }
    const encryptedPersistedSettings = encryptPersistedAPIKeys(
      this.host.settings as PersistedExcalidrawSettings,
    );
    const shouldPersistEncryptedSettings =
      JSON.stringify(encryptedPersistedSettings) !==
      JSON.stringify(persistedSettings);
    if (shouldPersistStartupChoice) {
      await this.persistSnapshot(encryptedPersistedSettings);
      if (recoveredInvalidStartup) {
        new Notice(t("SETTINGS_DATA_RECOVERED"), 12000);
      }
    } else if (
      !this.persistenceBlockedByInvalidData &&
      (didSettingsMigration || shouldPersistEncryptedSettings)
    ) {
      await this.persistSnapshot(encryptedPersistedSettings);
    } else if (!this.persistenceBlockedByInvalidData) {
      await this.saveRecoverySnapshot(encryptedPersistedSettings);
    }
    this.hasCompletedInitialLoad = true;
    return !hasInvalidSettings;
  }

  /** Encrypts protected fields and persists the current settings object. */
  public saveSettings(): Promise<void> {
    if (this.persistenceBlockedByInvalidData) {
      this.showMissingRecoveryNotice();
      return Promise.resolve();
    }
    return this.persistSnapshot(
      encryptPersistedAPIKeys(
        this.host.settings as PersistedExcalidrawSettings,
      ),
    );
  }

  /** Whether plugin startup is intentionally waiting for a recovery choice. */
  public get isAwaitingStartupRecoveryChoice(): boolean {
    return this.awaitingStartupRecoveryChoice;
  }

  private persistSnapshot(
    settings: PersistedExcalidrawSettings,
  ): Promise<void> {
    return this.writer.persist(settings);
  }

  /** Closes the device-local recovery database connection. */
  public destroy(): void {
    this.recoveryStore.destroy();
  }

  private async getSettingsDataFileState(): Promise<SettingsDataFileState> {
    const pluginDirectory = this.host.manifest.dir;
    if (!pluginDirectory) {
      return "unknown";
    }
    try {
      const stat = await this.host.app.vault.adapter.stat(
        `${pluginDirectory}/data.json`,
      );
      if (!stat) {
        return "missing";
      }
      return stat.size === 0 ? "empty" : "present";
    } catch {
      return "unknown";
    }
  }

  private blockPersistenceWhileWaitingForFile(): void {
    this.persistenceBlockedByInvalidData = true;
    this.missingRecoveryNoticeShown = false;
  }

  private showMissingRecoveryNotice(): void {
    if (this.missingRecoveryNoticeShown) {
      return;
    }
    this.missingRecoveryNoticeShown = true;
    console.error(
      "Excalidraw settings data is empty or unreadable; waiting for a valid replacement file",
    );
    new Notice(t("SETTINGS_DATA_INVALID"), 12000);
  }

  private async requestStartupRecoveryChoice(
    mode: SettingsRecoveryPromptMode,
  ): Promise<SettingsRecoveryChoice> {
    this.awaitingStartupRecoveryChoice = true;
    try {
      return await this.promptForRecoveryChoice(mode);
    } finally {
      this.awaitingStartupRecoveryChoice = false;
    }
  }

  private async loadRecoverySnapshot(): Promise<PersistedExcalidrawSettings | null> {
    try {
      const recoveredSettings = await this.recoveryStore.load();
      return isSettingsDataRecord(recoveredSettings) ? recoveredSettings : null;
    } catch (error) {
      console.error("Could not load Excalidraw settings recovery", error);
      return null;
    }
  }

  private async saveRecoverySnapshot(
    settings: PersistedExcalidrawSettings,
  ): Promise<void> {
    try {
      await this.recoveryStore.save(settings);
    } catch (error) {
      console.error("Could not update Excalidraw settings recovery", error);
    }
  }
}
