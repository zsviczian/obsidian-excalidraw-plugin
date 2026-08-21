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

/**
 * Owns plugin settings persistence, default assembly, and compatibility
 * migrations while leaving startup readiness and settings UI registration to
 * the plugin lifecycle.
 */
export class PluginSettingsManager {
  private readonly writer: SerializedSettingsWriter<PersistedExcalidrawSettings>;
  private hasCompletedInitialLoad = false;
  private persistenceBlockedByInvalidData = false;
  private invalidDataNoticeShown = false;

  public constructor(private readonly host: PluginSettingsHost) {
    this.writer = new SerializedSettingsWriter({
      saveData: (data) => this.host.saveData(data),
    });
  }

  /**
   * Loads persisted settings, applies defaults and migrations, and decrypts
   * protected API-key fields.
   *
   * @remarks Unknown persisted properties are intentionally retained.
   * @returns `false` when invalid data was rejected and active/default
   * settings were retained without persistence.
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
    const hasValidSettings = isSettingsDataRecord(loadedSettings);
    const hasInvalidSettings = classification === "invalid";

    if (hasInvalidSettings) {
      this.blockPersistenceForInvalidData();
      if (this.hasCompletedInitialLoad) {
        return false;
      }
    } else {
      this.persistenceBlockedByInvalidData = false;
      this.invalidDataNoticeShown = false;
    }

    const persistedSettings = (hasValidSettings ? loadedSettings : {}) as
      PersistedExcalidrawSettings;
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
    if (
      !this.persistenceBlockedByInvalidData &&
      (didSettingsMigration || shouldPersistEncryptedSettings)
    ) {
      await this.persistSnapshot(encryptedPersistedSettings);
    }
    this.hasCompletedInitialLoad = true;
    return !hasInvalidSettings;
  }

  /** Encrypts protected fields and persists the current settings object. */
  public saveSettings(): Promise<void> {
    if (this.persistenceBlockedByInvalidData) {
      this.showInvalidDataNotice();
      return Promise.resolve();
    }
    return this.persistSnapshot(
      encryptPersistedAPIKeys(
        this.host.settings as PersistedExcalidrawSettings,
      ),
    );
  }

  private persistSnapshot(
    settings: PersistedExcalidrawSettings,
  ): Promise<void> {
    return this.writer.persist(settings);
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

  private blockPersistenceForInvalidData(): void {
    this.persistenceBlockedByInvalidData = true;
    this.showInvalidDataNotice();
  }

  private showInvalidDataNotice(): void {
    if (this.invalidDataNoticeShown) {
      return;
    }
    this.invalidDataNoticeShown = true;
    console.error(
      "Excalidraw settings data is empty or unreadable; persistence is paused",
    );
    new Notice(t("SETTINGS_DATA_INVALID"), 12000);
  }
}
