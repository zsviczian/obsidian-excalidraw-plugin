import {
  App,
  ButtonComponent,
  DropdownComponent,
  normalizePath,
  Notice,
  PluginSettingTab,
  requireApiVersion,
  Setting,
  TextComponent,
} from "obsidian";
import {
  LOGO_EXCALIDRAW_MASTERY,
  setRootElementSize,
} from "src/constants/constants";
import { t } from "src/lang/helpers";
import type ExcalidrawPlugin from "src/core/main";
import { PreviewImageType } from "src/types/utilTypes";
import { setDynamicStyle } from "src/utils/dynamicStyling";
import {
  createOrOverwriteFile,
  getDrawingFilename,
  getEmbedFilename,
} from "src/utils/fileUtils";
import { addYouTubeThumbnail, fragWithHTML } from "src/utils/utils";
import {
  setElementHidden,
  setSanitizedHtml,
} from "src/utils/htmlUtils";
import { getImageCache } from "src/shared/ImageCache";
import { MultiOptionConfirmationPrompt } from "src/shared/Dialogs/Prompt";
import { EmbeddalbeMDFileCustomDataSettingsComponent } from "src/shared/Dialogs/EmbeddableMDFileCustomDataSettingsComponent";
import { AutostartScriptsSettingsComponent } from "src/shared/Dialogs/AutostartScriptsSettingsComponent";
import { startupScript } from "src/constants/starutpscript";
import { ModifierKeySettingsComponent } from "src/shared/Dialogs/ModifierKeySettings";
import { EDITOR_FADEOUT } from "src/core/editor/EditorHandler";
import {
  TAG_AUTOEXPORT,
  TAG_MDREADINGMODE,
  TAG_PDFEXPORT,
} from "src/constants/constSettingsTags";
import { HotkeyEditor } from "src/shared/Dialogs/HotkeyEditor";
import { getExcalidrawViews } from "src/utils/obsidianUtils";
import { createSliderWithText } from "src/utils/sliderUtils";
import { PDFExportSettingsComponent } from "src/shared/Dialogs/PDFExportSettingsComponent";
import { ContentSearcher } from "src/shared/components/ContentSearcher";
import { UIModeSettingsComponent } from "src/shared/Dialogs/UIModeSettingComponent";
import { ScriptSettingValue } from "src/types/excalidrawAutomateTypes";
import {
  AIImageModelConfig,
  AIModelConfig,
  AIProviderProfile,
} from "src/types/AIUtilTypes";
import { AIProviderProfileModal } from "src/shared/Dialogs/AIProviderProfileModal";
import { AIModelConfigModal } from "src/shared/Dialogs/AIModelConfigModal";
import { AIUsageModal } from "src/shared/Dialogs/AIUsageModal";
import { getAIUsage, formatAIUsageLabel } from "src/utils/AIUtils";
import { decryptProviderProfiles } from "src/utils/settingsKeyObfuscation";
import { getGeminiSupportedSizes } from "src/utils/geminiImageModelUtils";
import { URLs } from "src/constants/safeUrls";
import { hideElement, setStyle, showElement } from "src/utils/styleUtils";
import { getSelectableFontOptions } from "src/utils/fontUtils";
import { FontPickerComponent } from "src/shared/components/FontPickerComponent";
import { VaultPathSuggest } from "src/shared/Suggesters/VaultPathSuggest";
import { confirmAndCreateFolder } from "src/shared/Dialogs/CreateFolderPrompt";
import {
  cloneKnownAIProviderProfiles,
  KNOWN_AI_TEXT_MODEL_CONFIGS,
  KNOWN_AI_IMAGE_MODEL_CONFIGS,
  cloneModelConfigs,
} from "src/core/settingsDefaults";
import { SettingBindingRegistry } from "src/core/settings/SettingBindingRegistry";
import { LegacySettingsAdapter } from "src/core/settings/LegacySettingsAdapter";
import { DeclarativeSettingsAdapter } from "src/core/settings/DeclarativeSettingsAdapter";
import { SettingsPersistenceQueue } from "src/core/settings/SettingsPersistenceQueue";
import type {
  SettingBindingKey,
  SettingSpec,
} from "src/core/settings/settingSpecs";
import {
  getDeclarativeSettingTabRuntime,
  type SettingDefinition,
  type SettingDefinitionItem,
} from "src/types/obsidianDeclarativeSettings";
import {
  annotateMarkdownDefinition,
  declarativeSettingsToMarkdown,
} from "src/core/settings/declarativeSettingsMarkdown";

declare const mainDocument: Document;

/** Strips characters that are invalid in filenames on common filesystems. */
const sanitizeFilenameSegment = (value: string): string =>
  value.replaceAll(/[<>:"/\\|?*]/g, "_");

const configurePasswordTextInput = (text: TextComponent) => {
  const { inputEl } = text;
  inputEl.type = "password";
  inputEl.autocomplete = "off";
  inputEl.spellcheck = false;
  inputEl.addEventListener("focus", () => {
    inputEl.type = "text";
  });
  inputEl.addEventListener("blur", () => {
    inputEl.type = "password";
  });
};

interface SettingsPageModel {
  name: string;
  description: string;
  children?: SettingsPageModel[];
  buildDefinitions?: () => SettingDefinitionItem<SettingBindingKey>[];
  renderLegacy?: (container: HTMLElement) => void;
}

export class ExcalidrawSettingTab extends PluginSettingTab {
  plugin: ExcalidrawPlugin;
  private requestEmbedUpdate: boolean = false;
  private requestReloadDrawings: boolean = false;
  private requestUpdatePinnedPens: boolean = false;
  private requestUpdateDynamicStyling: boolean = false;
  private readonly settingsPersistenceQueue: SettingsPersistenceQueue;
  private readonly settingBindings: SettingBindingRegistry;
  private readonly legacySettingsAdapter: LegacySettingsAdapter;
  private readonly declarativeSettingsAdapter: DeclarativeSettingsAdapter;
  private readonly useDeclarativeSettingsForSession: boolean;
  private declarativeDefinitionsActive = false;
  private declarativeDisplayPrepared = false;
  private declarativeDefinitions: SettingDefinitionItem<SettingBindingKey>[] = [];
  private persistenceOwnerWindow: Window | null = null;
  private readonly flushOnSettingsWindowBlur = (): void => {
    void this.settingsPersistenceQueue.flush().catch((): void => undefined);
  };
  private hotkeyEditor: HotkeyEditor;
  private fontPickers: FontPickerComponent[] = [];
  /**
   * Filename-sample preview element from the Saving section, refreshed by
   * both that section and the Compatibility section's compatibilityMode
   * toggle (which changes how sample filenames are generated).
   */
  private filenameSampleEl: HTMLElement;
  //private reloadMathJax: boolean = false;
  //private applyDebounceTimer: number = 0;

  constructor(app: App, plugin: ExcalidrawPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.useDeclarativeSettingsForSession =
      requireApiVersion("1.13.0") &&
      this.plugin.settings.useDeclarativeSettings !== false;
    this.settingBindings = new SettingBindingRegistry({
      getSettings: () => this.plugin.settings,
      queueSettingsUpdate: (requestReloadDrawings) =>
        this.queueSettingsUpdate(requestReloadDrawings),
    });
    this.legacySettingsAdapter = new LegacySettingsAdapter(
      this.settingBindings,
      {
        addVaultPathSupport: (setting, text, kind, options) =>
          this.addVaultPathSupport(setting, text, kind, options),
      },
    );
    this.declarativeSettingsAdapter = new DeclarativeSettingsAdapter(
      this.settingBindings,
      this.legacySettingsAdapter,
    );
    this.settingsPersistenceQueue = new SettingsPersistenceQueue({
      persistSettings: async () => {
        this.normalizeSettingsBeforeSave();
        await this.plugin.saveSettings();
      },
      applyPendingActions: () => this.applyPendingActions(),
      // Obsidian 1.13 rebuilds an active legacy-fallback tab after plugin data
      // persistence. Do not let that replacement interrupt text entry.
      shouldDeferPersistence: () => this.isEditableSettingControlFocused(),
    });
  }

  private destroyFontPickers(): void {
    for (const picker of this.fontPickers) {
      picker.destroy();
    }
    this.fontPickers = [];
  }

  private isEditableSettingControlFocused(): boolean {
    const activeElement = this.containerEl.ownerDocument.activeElement;
    return Boolean(
      activeElement &&
      this.containerEl.contains(activeElement) &&
      activeElement.matches(
        'textarea, [contenteditable="true"], input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"])',
      ),
    );
  }

  private attachPersistenceWindowBlurHandler(): void {
    this.detachPersistenceWindowBlurHandler();
    const ownerWindow = this.containerEl.ownerDocument.defaultView;
    if (!ownerWindow) {
      return;
    }
    this.persistenceOwnerWindow = ownerWindow;
    ownerWindow.addEventListener("blur", this.flushOnSettingsWindowBlur);
  }

  private detachPersistenceWindowBlurHandler(): void {
    this.persistenceOwnerWindow?.removeEventListener(
      "blur",
      this.flushOnSettingsWindowBlur,
    );
    this.persistenceOwnerWindow = null;
  }

  /** Legacy compatibility delegate for canonical setting specifications. */
  private buildSetting(
    container: HTMLElement,
    spec: SettingSpec,
  ): Setting | undefined {
    return this.legacySettingsAdapter.render(container, spec);
  }

  private renderSettingSpecs(
    container: HTMLElement,
    specs: readonly SettingSpec[],
  ): void {
    for (const spec of specs) {
      this.buildSetting(container, spec);
    }
  }

  private toDeclarativeDefinitions(
    specs: readonly SettingSpec[],
  ): SettingDefinition<SettingBindingKey>[] {
    return specs.map((spec) =>
      this.declarativeSettingsAdapter.toDefinition(spec),
    );
  }

  private refreshSettingsUI(): void {
    const runtime = getDeclarativeSettingTabRuntime(this);
    if (this.declarativeDefinitionsActive && runtime) {
      runtime.update();
      return;
    }
    this.display();
  }

  private prepareDeclarativeDisplay(): void {
    if (this.declarativeDisplayPrepared) {
      return;
    }
    this.declarativeDisplayPrepared = true;
    this.requestEmbedUpdate = false;
    this.requestReloadDrawings = false;
    this.destroyFontPickers();
    this.containerEl.addClass("excalidraw-settings");
    this.attachPersistenceWindowBlurHandler();
  }

  private getSettingsLayoutSpec(): SettingSpec {
    return {
      name: t("USE_DECLARATIVE_SETTINGS_NAME"),
      desc: t("USE_DECLARATIVE_SETTINGS_DESC"),
      aliases: ["searchable settings", "legacy settings", "settings layout"],
      control: { type: "toggle", key: "useDeclarativeSettings" },
    };
  }

  private getFilenameSample(): string {
    return `${t(
      "FILENAME_SAMPLE",
    )}<a href=${URLs.WWW_YOUTUBE_COM_VISUALPKM} target='_blank'>${getDrawingFilename(
      this.plugin.settings,
    )}</a></b><br>${t(
      "FILENAME_EMBED_SAMPLE",
    )}<a href=${URLs.WWW_YOUTUBE_COM_VISUALPKM} target='_blank'>${getEmbedFilename(
      "{NOTE_NAME}",
      this.plugin.settings,
    )}</a></b>`;
  }

  private prepareFullWidthDeclarativeSetting(setting: Setting): void {
    setting.settingEl.empty();
    setting.settingEl.addClass("excalidraw-declarative-full-width");
  }

  private createSectionDescriptionDefinition(
    name: string,
    description: string,
  ): SettingDefinition<SettingBindingKey> {
    return annotateMarkdownDefinition(
      {
        name,
        searchable: false,
        render: (setting) => {
          this.prepareFullWidthDeclarativeSetting(setting);
          setting.settingEl.createDiv({
            text: description,
            cls: "setting-item-description",
          });
        },
      },
      { omit: true },
    );
  }

  private createDeclarativeUtilitiesDefinition(
    scope: string,
    includeMastery: boolean,
  ): SettingDefinition<SettingBindingKey> {
    return annotateMarkdownDefinition(
      {
        name: `Excalidraw settings utilities · ${scope}`,
        searchable: false,
        render: (setting) => {
          this.prepareDeclarativeDisplay();
          this.prepareFullWidthDeclarativeSetting(setting);
          this.renderSettingsUtilityBar(setting.settingEl, () => {
            void this.copyDeclarativeSettingsAsMarkdown();
          });
          if (includeMastery) {
            this.renderMasteryPromo(setting.settingEl);
          }
        },
      },
      { omit: true },
    );
  }

  private createDeclarativePageItems(
    scope: string,
    description: string,
    items: SettingDefinitionItem<SettingBindingKey>[],
  ): SettingDefinitionItem<SettingBindingKey>[] {
    return [
      this.createDeclarativeUtilitiesDefinition(scope, false),
      this.createSectionDescriptionDefinition(
        `${scope} · overview`,
        description,
      ),
      ...items,
    ];
  }

  private createLibraryStorageDefinition(): SettingDefinition<SettingBindingKey> {
    return annotateMarkdownDefinition(
      {
        name: t("LIBRARY_STORAGE_NAME"),
        desc: t("LIBRARY_STORAGE_DESC"),
        aliases: [
          t("LIBRARY_STORAGE_VAULT"),
          t("LIBRARY_STORAGE_DATA_JSON"),
          "stencil library",
        ],
        render: (setting) => this.configureLibraryStorageSetting(setting),
      },
      { controlType: "dropdown" },
    );
  }

  private createLibraryMigrationDefinition(): SettingDefinition<SettingBindingKey> {
    return annotateMarkdownDefinition(
      {
        name: t("LIBRARY_MIGRATE_NOW"),
        desc: t("LIBRARY_MIGRATE_NOW_DESC"),
        aliases: [t("LIBRARY_MIGRATION_MIGRATE"), "stencil library"],
        visible: () => this.isLibraryMigrationAvailable(),
        render: (setting) => this.configureLibraryMigrationSetting(setting),
      },
      { controlType: "action" },
    );
  }

  private createFilenameInformationDefinition(): SettingDefinition<SettingBindingKey> {
    return annotateMarkdownDefinition(
      {
        name: t("FILENAME_HEAD"),
        desc: t("FILENAME_DESC"),
        aliases: ["filename preview", "file naming", "drawing name"],
        render: (setting) => {
          this.prepareFullWidthDeclarativeSetting(setting);
          this.renderFilenameInformation(setting.settingEl);
        },
      },
      { omit: true },
    );
  }

  private createTemplateVideoDefinition(): SettingDefinition<SettingBindingKey> {
    return annotateMarkdownDefinition(
      {
        name: `${t("TEMPLATE_NAME")} · YouTube`,
        searchable: false,
        render: (setting) => {
          this.prepareFullWidthDeclarativeSetting(setting);
          addYouTubeThumbnail(setting.settingEl, "jgUpYznHP9A", 216);
        },
      },
      { omit: true },
    );
  }

  private getCheckpoint4APages(): SettingsPageModel[] {
    const basicPage: SettingsPageModel = {
      name: t("BASIC_HEAD"),
      description: t("BASIC_DESC"),
      children: [
        {
          name: t("BASIC_UPDATES_STARTUP_HEAD"),
          description: t("BASIC_UPDATES_STARTUP_DESC"),
          buildDefinitions: () =>
            this.toDeclarativeDefinitions(this.getGeneralStartupSpecs()),
          renderLegacy: (container) =>
            this.renderSettingSpecs(container, this.getGeneralStartupSpecs()),
        },
        {
          name: t("BASIC_FILES_FOLDERS_HEAD"),
          description: t("BASIC_FILES_FOLDERS_DESC"),
          buildDefinitions: () => [
            ...this.toDeclarativeDefinitions(
              this.getGeneralDrawingFolderSpecs(),
            ),
            ...this.toDeclarativeDefinitions(this.getGeneralTrailingSpecs()),
            ...this.toDeclarativeDefinitions(this.getGeneralScriptSpecs()),
            this.createTemplateVideoDefinition(),
          ],
          renderLegacy: (container) => {
            this.renderSettingSpecs(
              container,
              this.getGeneralDrawingFolderSpecs(),
            );
            this.renderSettingSpecs(container, this.getGeneralTrailingSpecs());
            this.renderSettingSpecs(container, this.getGeneralScriptSpecs());
            addYouTubeThumbnail(container, "jgUpYznHP9A", 216);
          },
        },
        {
          name: t("BASIC_STENCIL_LIBRARY_HEAD"),
          description: t("BASIC_STENCIL_LIBRARY_DESC"),
          buildDefinitions: () => [
            this.createLibraryStorageDefinition(),
            ...this.toDeclarativeDefinitions(this.getGeneralLibrarySpecs()),
            this.createLibraryMigrationDefinition(),
          ],
          renderLegacy: (container) => {
            this.configureLibraryStorageSetting(new Setting(container));
            this.renderSettingSpecs(container, this.getGeneralLibrarySpecs());
            if (this.isLibraryMigrationAvailable()) {
              this.configureLibraryMigrationSetting(new Setting(container));
            }
          },
        },
      ],
    };

    const savingPage: SettingsPageModel = {
      name: t("SAVING_HEAD"),
      description: t("SAVING_DESC"),
      children: [
        {
          name: t("SAVING_STORAGE_AUTOSAVE_HEAD"),
          description: t("SAVING_STORAGE_AUTOSAVE_DESC"),
          buildDefinitions: () =>
            this.toDeclarativeDefinitions(this.getSavingSpecs()),
          renderLegacy: (container) =>
            this.renderSettingSpecs(container, this.getSavingSpecs()),
        },
        {
          name: t("FILENAME_HEAD"),
          description: t("FILENAME_GROUP_DESC"),
          buildDefinitions: () => [
            this.createFilenameInformationDefinition(),
            ...this.toDeclarativeDefinitions(this.getFilenameSpecs()),
          ],
          renderLegacy: (container) => {
            this.renderFilenameInformation(container);
            this.renderSettingSpecs(container, this.getFilenameSpecs());
          },
        },
      ],
    };

    return [basicPage, savingPage];
  }

  private toDeclarativePage(
    page: SettingsPageModel,
  ): SettingDefinitionItem<SettingBindingKey> {
    const items = page.children
      ? page.children.map((child) => this.toDeclarativePage(child))
      : (page.buildDefinitions?.() ?? []);
    return {
      type: "page",
      name: page.name,
      desc: page.description,
      items: this.createDeclarativePageItems(
        page.name,
        page.description,
        items,
      ),
    };
  }

  private renderLegacyPage(
    parent: HTMLElement,
    page: SettingsPageModel,
    headingLevel: 1 | 3 | 4,
  ): void {
    if (headingLevel !== 1) {
      parent.createEl("hr", { cls: "excalidraw-setting-hr" });
    }
    parent.createDiv({
      text: page.description,
      cls: "setting-item-description",
    });
    const details = parent.createEl("details");
    details.createEl("summary", {
      text: page.name,
      cls: `excalidraw-setting-h${headingLevel}`,
    });

    const childHeadingLevel = headingLevel === 1 ? 3 : 4;
    page.children?.forEach((child) =>
      this.renderLegacyPage(details, child, childHeadingLevel),
    );
    page.renderLegacy?.(details);
  }

  private buildCheckpoint4ADefinitions(): SettingDefinitionItem<SettingBindingKey>[] {
    this.declarativeSettingsAdapter.beginBuild();
    return [
      this.createDeclarativeUtilitiesDefinition("Root", true),
      this.declarativeSettingsAdapter.toDefinition(
        this.getSettingsLayoutSpec(),
      ),
      ...this.getCheckpoint4APages().map((page) =>
        this.toDeclarativePage(page),
      ),
    ];
  }
  /**
   * Keeps the imperative settings UI active until every conversion batch and
   * the search/layout checkpoint are complete. Obsidian also calls this early
   * for indexing, so the inactive path only clears stale binding metadata.
   *
   * @returns An empty list so Obsidian falls back to {@link display}.
   */
  getSettingDefinitions(): SettingDefinitionItem<SettingBindingKey>[] {
    if (!this.useDeclarativeSettingsForSession) {
      this.declarativeSettingsAdapter.beginBuild();
      this.declarativeDefinitions = [];
      this.declarativeDefinitionsActive = false;
      return [];
    }
    const definitions = this.buildCheckpoint4ADefinitions();
    this.declarativeDefinitions = definitions;
    this.declarativeDefinitionsActive = definitions.length > 0;
    return this.declarativeDefinitionsActive ? definitions : [];
  }

  /** Reads a registered declarative control through the canonical binding. */
  getControlValue(key: string): unknown {
    return this.settingBindings.getControlValue(key);
  }

  /** Writes and persists a registered declarative control mutation. */
  setControlValue(key: string, value: unknown): Promise<void> {
    return this.settingBindings.setControlValue(key, value);
  }

  private normalizeSettingsBeforeSave() {
    this.plugin.settings.scriptFolderPath = normalizePath(
      this.plugin.settings.scriptFolderPath,
    );
    if (
      this.plugin.settings.scriptFolderPath === "/" ||
      this.plugin.settings.scriptFolderPath === ""
    ) {
      this.plugin.settings.scriptFolderPath = "Excalidraw/Scripts";
    }
    this.plugin.settings.libraryFolderPath = normalizePath(
      this.plugin.settings.libraryFolderPath ||
        `${this.plugin.settings.folder}/Libraries`,
    );
    this.plugin.settings.libraryFileName =
      this.plugin.settings.libraryFileName
        .trim()
        .replace(/[\\/]/g, "-")
        .replace(/\.excalidrawlib$/i, "") || "local-library";
  }

  private addVaultPathSupport(
    setting: Setting,
    text: TextComponent,
    kind: "file" | "folder",
    options: {
      optional?: boolean;
      extensions?: readonly string[];
      resolvePath?: (value: string) => string;
      createFolder?: boolean;
      validate?: boolean;
    } = {},
  ): void {
    new VaultPathSuggest(this.app, text.inputEl, kind, options.extensions);
    let createFolderButtonEl: HTMLButtonElement | null = null;
    const updateWarning = () => {
      setting.descEl
        .querySelectorAll(".excalidraw-path-warning")
        .forEach((element) => element.remove());
      setting.settingEl.removeClass("mod-warning", "mod_warning");
      const value = text.getValue().trim();
      const resolvedValue = options.resolvePath?.(value) ?? value;
      const path = resolvedValue ? normalizePath(resolvedValue) : "";
      const exists = path
        ? kind === "folder"
          ? Boolean(this.app.vault.getFolderByPath(path))
          : Boolean(this.app.vault.getFileByPath(path))
        : false;
      if (createFolderButtonEl) {
        setElementHidden(
          createFolderButtonEl,
          kind !== "folder" || !value || exists,
        );
      }
      if ((!value && options.optional) || options.validate === false) {
        return;
      }
      if (exists) {
        return;
      }
      setting.settingEl.addClass("mod-warning", "mod_warning");
      setting.descEl.createDiv({
        cls: "excalidraw-path-warning mod-warning",
        text: t("LIBRARY_PATH_MISSING"),
      });
    };
    if (kind === "folder" && options.createFolder !== false) {
      setting.addButton((button) => {
        createFolderButtonEl = button.buttonEl;
        setElementHidden(button.buttonEl, true);
        button.setButtonText(t("CREATE_FOLDER")).onClick(async () => {
          if (await confirmAndCreateFolder(this.plugin, text.getValue())) {
            updateWarning();
          }
        });
      });
      setting.controlEl.addClass("excalidraw-folder-path-control");
      const createFolderRow = setting.controlEl.createDiv({
        cls: "excalidraw-folder-create-row",
      });
      createFolderRow.appendChild(createFolderButtonEl);
    }
    text.inputEl.addEventListener("input", updateWarning);
    updateWarning();
  }

  private async applyPendingActions() {
    if (this.requestUpdatePinnedPens) {
      this.requestUpdatePinnedPens = false;
      getExcalidrawViews(this.app, true).forEach((excalidrawView) =>
        excalidrawView.updatePinnedCustomPens(),
      );
    }
    if (this.requestUpdateDynamicStyling) {
      this.requestUpdateDynamicStyling = false;
      getExcalidrawViews(this.app, true).forEach((excalidrawView) =>
        setDynamicStyle(
          this.plugin.ea,
          excalidrawView,
          excalidrawView.previousBackgroundColor,
          this.plugin.settings.dynamicStyling,
        ),
      );
    }
    if (this.requestReloadDrawings) {
      this.requestReloadDrawings = false;
      const excalidrawViews = getExcalidrawViews(this.app, true);
      for (const excalidrawView of excalidrawViews) {
        await excalidrawView.save(false);
        //debug({where:"ExcalidrawSettings.hide",file:v.view.file.name,before:"reload(true)"})
        await excalidrawView.reload(true);
      }
      this.requestEmbedUpdate = true;
    }
    if (this.requestEmbedUpdate) {
      this.requestEmbedUpdate = false;
      this.plugin.triggerEmbedUpdates();
    }
  }

  private queueSettingsUpdate(
    requestReloadDrawings: boolean = false,
  ): Promise<void> {
    if (requestReloadDrawings) {
      this.requestReloadDrawings = true;
    }
    return this.settingsPersistenceQueue.enqueue();
  }

  applySettingsUpdate(requestReloadDrawings: boolean = false) {
    void this.queueSettingsUpdate(requestReloadDrawings).catch(
      (): void => undefined,
    );
  }

  hide() {
    this.declarativeDisplayPrepared = false;
    this.detachPersistenceWindowBlurHandler();
    void this.settingsPersistenceQueue.flush().catch((): void => undefined);
    this.destroyFontPickers();
    if (this.plugin.settings.overrideObsidianFontSize) {
      setStyle(mainDocument.documentElement, { fontSize: "" });
      setRootElementSize(16);
    } else if (!mainDocument.documentElement.style.fontSize) {
      setStyle(mainDocument.documentElement, {
        fontSize: getComputedStyle(mainDocument.body).getPropertyValue(
          "--font-text-size",
        ),
      });
      setRootElementSize();
    }

    this.hotkeyEditor?.unload();
    if (this.hotkeyEditor?.isDirty) {
      this.plugin.registerHotkeyOverrides();
    }
    this.plugin.scriptEngine.updateScriptPath();
    /*    if(this.reloadMathJax) {
      this.plugin.loadMathJax();
    }*/
  }

  display() {
    //await this.plugin.loadSettings(); //in case sync loaded changed settings in the background
    this.requestEmbedUpdate = false;
    this.requestReloadDrawings = false;
    this.declarativeDisplayPrepared = false;
    this.destroyFontPickers();
    const { containerEl } = this;
    containerEl.addClass("excalidraw-settings");
    this.containerEl.empty();
    this.attachPersistenceWindowBlurHandler();

    const contentSearcher = this.renderSearchSection();
    this.renderSettingsUtilityBar(containerEl, () =>
      contentSearcher.copyContentAsMarkdown(),
    );
    this.renderMasteryPromo(containerEl);
    if (requireApiVersion("1.13.0")) {
      this.buildSetting(containerEl, this.getSettingsLayoutSpec());
    }
    this.renderCheckpoint4ALegacyPages();
    this.renderAISection();
    this.renderDisplaySection();
    this.renderLinksAndTransclusionsSection();
    this.renderEmbedAndExportSection();
    this.renderEmbeddingSettingsSection();
    this.renderNonExcalidrawFeaturesSection();
    this.renderFontsSection();
    this.renderExperimentalFeaturesSection();
    this.renderExcalidrawAutomateSection();
    this.renderCompatibilitySection();
  }

  private async copyDeclarativeSettingsAsMarkdown(): Promise<void> {
    const markdown = declarativeSettingsToMarkdown(
      this.declarativeDefinitions,
    );
    const ownerWindow = this.containerEl.ownerDocument.defaultView;
    if (!ownerWindow) {
      return;
    }
    await ownerWindow.navigator.clipboard.writeText(markdown);
    new Notice(t("SEARCH_COPIED_TO_CLIPBOARD"));
  }

  private renderSettingsUtilityBar(
    container: HTMLElement,
    copySettings: () => void,
  ): void {
    const toolbar = container.createDiv(
      "excalidraw-declarative-settings-toolbar",
    );
    const copyButton = toolbar.createEl("button", {
      text: t("SETTINGS_TOOLBAR_COPY"),
      cls: "excalidraw-declarative-settings-toolbar__button",
      attr: {
        type: "button",
        "aria-label": t("SEARCH_COPY_TO_CLIPBOARD_ARIA"),
      },
    });
    copyButton.addEventListener("click", copySettings);

    const links = [
      {
        href: URLs.NOTEBOOKLM_GOOGLE_COM_NOTEBOOK_42D76A2F_C11D_4002_9286_1683C43D0AB0,
        aria: t("NOTEBOOKLM_LINK_ARIA"),
        text: t("SETTINGS_TOOLBAR_NOTEBOOKLM"),
      },
      {
        href: URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_ISSUES,
        aria: t("LINKS_BUGS_ARIA"),
        text: t("SETTINGS_TOOLBAR_BUGS"),
      },
      {
        href: URLs.COMMUNITY_SKETCH_YOUR_MIND_COM_WIKI,
        aria: t("LINKS_WIKI_ARIA"),
        text: t("SETTINGS_TOOLBAR_WIKI"),
      },
      {
        href: URLs.WWW_YOUTUBE_COM_VISUALPKM,
        aria: t("LINKS_YT_ARIA"),
        text: t("SETTINGS_TOOLBAR_YOUTUBE"),
      },
      {
        href: URLs.COMMUNITY_SKETCH_YOUR_MIND_COM_EE,
        aria: t("LINKS_JOIN_SYM_ARIA"),
        text: t("SETTINGS_TOOLBAR_LEARN"),
      },
      {
        href: URLs.TWITTER_COM_ZSVICZIAN,
        aria: t("LINKS_TWITTER"),
        text: t("SETTINGS_TOOLBAR_FOLLOW"),
      },
      {
        href: URLs.COMMUNITY_SKETCH_YOUR_MIND_COM_SYM,
        aria: t("LINKS_BOOK_ARIA"),
        text: t("SETTINGS_TOOLBAR_READ"),
      },
      {
        href: URLs.KO_FI_COM_ZSOLT,
        aria: t("SETTINGS_TOOLBAR_KOFI"),
        text: t("SETTINGS_TOOLBAR_KOFI"),
      },
    ];

    for (const link of links) {
      toolbar.createEl("a", {
        text: link.text,
        href: link.href,
        attr: {
          "aria-label": link.aria,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      });
    }
  }

  private renderMasteryPromo(container: HTMLElement): void {
    const excalidrawMasteryPromo = container.createEl("details", {
      cls: "setting-item-description excalidraw-mastery-promo",
    });
    excalidrawMasteryPromo.open =
      !this.plugin.settings.excalidrawMasteryPromoCollapsed;
    excalidrawMasteryPromo.classList.toggle(
      "is-collapsed",
      this.plugin.settings.excalidrawMasteryPromoCollapsed,
    );

    const excalidrawMasterySummary = excalidrawMasteryPromo.createEl(
      "summary",
      { cls: "excalidraw-mastery-promo__summary" },
    );
    const excalidrawMasterySummaryTitle = excalidrawMasterySummary.createSpan({
      cls: "excalidraw-mastery-promo__summary-title",
      text: t("EXCALIDRAW_MASTERY"),
    });
    const excalidrawMasterySummaryState = excalidrawMasterySummary.createSpan({
      cls: "excalidraw-mastery-promo__summary-state",
    });

    const updateExcalidrawMasteryPromoState = (persist: boolean) => {
      const isCollapsed = !excalidrawMasteryPromo.open;
      const didStateChange =
        this.plugin.settings.excalidrawMasteryPromoCollapsed !== isCollapsed;
      this.plugin.settings.excalidrawMasteryPromoCollapsed = isCollapsed;
      excalidrawMasteryPromo.classList.toggle("is-collapsed", isCollapsed);
      excalidrawMasterySummaryTitle.classList.toggle("is-hidden", !isCollapsed);
      excalidrawMasterySummaryState.setText(
        isCollapsed
          ? t("EXCALIDRAW_MASTERY_PROMO_SHOW")
          : t("EXCALIDRAW_MASTERY_PROMO_HIDE"),
      );
      if (persist && didStateChange) {
        void this.plugin.saveSettings();
      }
    };

    excalidrawMasteryPromo.addEventListener("toggle", () =>
      updateExcalidrawMasteryPromoState(true),
    );
    updateExcalidrawMasteryPromoState(false);

    const excalidrawMasteryContent = excalidrawMasteryPromo.createDiv({
      cls: "excalidraw-mastery-promo__content",
    });
    const excalidrawMasteryImageLink = excalidrawMasteryContent.createEl("a", {
      cls: "excalidraw-mastery-promo__image-link",
      href: URLs.COMMUNITY_SKETCH_YOUR_MIND_COM_EM,
      attr: {
        "aria-label": t("EXCALIDRAW_MASTERY_PROMO_ARIA"),
        target: "_blank",
        rel: "noopener noreferrer",
      },
    });
    excalidrawMasteryImageLink.createEl("img", {
      cls: "excalidraw-mastery-promo__image",
      attr: {
        src: LOGO_EXCALIDRAW_MASTERY,
        alt: "Excalidraw Mastery",
      },
    });

    const excalidrawMasteryText = excalidrawMasteryContent.createDiv({
      cls: "excalidraw-mastery-promo__text",
    });
    setSanitizedHtml(excalidrawMasteryText, t("EXCALIDRAW_MASTERY_PROMO_HTML"));
    excalidrawMasteryText
      .querySelectorAll("a")
      .forEach((anchor: HTMLAnchorElement) => {
        anchor.setAttribute("aria-label", t("EXCALIDRAW_MASTERY_PROMO_ARIA"));
        anchor.setAttribute("target", "_blank");
        anchor.setAttribute("rel", "noopener noreferrer");
      });
  }

  private renderSearchSection(): ContentSearcher {
    return new ContentSearcher(this.containerEl);
  }

  private getGeneralStartupSpecs(): SettingSpec[] {
    return [
      {
        name: t("RELEASE_NOTES_NAME"),
        desc: fragWithHTML(t("RELEASE_NOTES_DESC")),
        control: { type: "toggle", key: "showReleaseNotes" },
      },
      {
        name: t("WARN_ON_MANIFEST_MISMATCH_NAME"),
        desc: fragWithHTML(t("WARN_ON_MANIFEST_MISMATCH_DESC")),
        control: { type: "toggle", key: "compareManifestToPluginVersion" },
      },
      {
        name: t("NEWVERSION_NOTIFICATION_NAME"),
        desc: fragWithHTML(t("NEWVERSION_NOTIFICATION_DESC")),
        control: { type: "toggle", key: "showNewVersionNotification" },
      },
      {
        name: t("TOGGLE_SPLASHSCREEN"),
        control: { type: "toggle", key: "showSplashscreen" },
      },
    ];
  }

  private getGeneralDrawingFolderSpecs(): SettingSpec[] {
    let previousFolder = "";
    return [
      {
        name: t("FOLDER_NAME"),
        desc: fragWithHTML(t("FOLDER_DESC")),
        aliases: ["drawing folder", "save location"],
        control: {
          type: "text",
          key: "folder",
          placeholder: t("FOLDER_PLACEHOLDER"),
          before: () => {
            previousFolder = this.plugin.settings.folder;
          },
          after: (value) => {
            if (
              this.plugin.settings.libraryFolderPath ===
              normalizePath(`${previousFolder}/Libraries`)
            ) {
              this.plugin.settings.libraryFolderPath = normalizePath(
                `${value}/Libraries`,
              );
            }
          },
          vaultPath: { kind: "folder" },
        },
      },
    ];
  }

  private getGeneralLibrarySpecs(): SettingSpec[] {
    const usesLegacyStorage =
      this.plugin.settings.libraryStorageMode === "data-json";
    return [
      {
        name: t("LIBRARY_FOLDER_NAME"),
        desc: t("LIBRARY_FOLDER_DESC"),
        aliases: ["stencil library folder", "library path"],
        control: {
          type: "text",
          key: "libraryFolderPath",
          after: () => this.plugin.stencilLibraryManager?.invalidate(),
          reload: true,
          disabled: () =>
            this.plugin.settings.libraryStorageMode === "data-json",
          vaultPath: {
            kind: "folder",
            options: {
              optional: usesLegacyStorage,
              createFolder: !usesLegacyStorage,
              validate: !usesLegacyStorage,
            },
          },
        },
      },
      {
        name: t("LIBRARY_FILE_NAME"),
        desc: t("LIBRARY_FILE_DESC"),
        aliases: ["stencil library filename"],
        control: {
          type: "text",
          key: "libraryFileName",
          after: () => this.plugin.stencilLibraryManager?.invalidate(),
          reload: true,
          disabled: () =>
            this.plugin.settings.libraryStorageMode === "data-json",
        },
      },
    ];
  }

  private getGeneralTrailingSpecs(): SettingSpec[] {
    return [
      {
        name: t("FOLDER_EMBED_NAME"),
        desc: fragWithHTML(t("FOLDER_EMBED_DESC")),
        control: { type: "toggle", key: "embedUseExcalidrawFolder" },
      },
      {
        name: t("CROP_FOLDER_NAME"),
        desc: fragWithHTML(t("CROP_FOLDER_DESC")),
        control: {
          type: "text",
          key: "cropFolder",
          placeholder: t("CROP_FOLDER_PLACEHOLDER"),
          vaultPath: { kind: "folder", options: { optional: true } },
        },
      },
      {
        name: t("ANNOTATE_FOLDER_NAME"),
        desc: fragWithHTML(t("ANNOTATE_FOLDER_DESC")),
        control: {
          type: "text",
          key: "annotateFolder",
          placeholder: t("ANNOTATE_FOLDER_PLACEHOLDER"),
          vaultPath: { kind: "folder", options: { optional: true } },
        },
      },
      {
        name: t("TEMPLATE_NAME"),
        desc: fragWithHTML(t("TEMPLATE_DESC")),
        aliases: ["drawing template", "template file"],
        control: {
          type: "text",
          key: "templateFilePath",
          placeholder: t("TEMPLATE_PLACEHOLDER"),
          vaultPath: {
            kind: "file",
            options: { optional: true, extensions: ["md", "excalidraw"] },
          },
        },
      },
    ];
  }

  private getGeneralScriptSpecs(): SettingSpec[] {
    return [
      {
        name: t("SCRIPT_FOLDER_NAME"),
        desc: fragWithHTML(t("SCRIPT_FOLDER_DESC")),
        aliases: ["Excalidraw Automate scripts", "script path"],
        control: {
          type: "text",
          key: "scriptFolderPath",
          placeholder: t("SCRIPT_FOLDER_PLACEHOLDER"),
          vaultPath: { kind: "folder" },
        },
      },
    ];
  }

  private configureLibraryStorageSetting(setting: Setting): void {
    setting
      .setName(t("LIBRARY_STORAGE_NAME"))
      .setDesc(t("LIBRARY_STORAGE_DESC"));
    if (!this.plugin.stencilLibraryManager) {
      setting.setDisabled(true);
    }
    setting.addDropdown((dropdown) =>
      dropdown
        .addOption("vault", t("LIBRARY_STORAGE_VAULT"))
        .addOption("data-json", t("LIBRARY_STORAGE_DATA_JSON"))
        .setValue(this.plugin.settings.libraryStorageMode)
        .onChange(async (value) => {
          const manager = this.plugin.stencilLibraryManager;
          if (!manager || value === this.plugin.settings.libraryStorageMode) {
            return;
          }
          if (value === "data-json") {
            await manager.switchToLegacyStorage();
          } else if (manager.hasLegacyItems()) {
            await manager.showMigrationPrompt();
          } else {
            this.plugin.settings.libraryStorageMode = "vault";
            this.plugin.settings.libraryMigrationStatus = "completed";
            this.plugin.settings.libraryMigrationSnoozeUntil = 0;
            manager.invalidate();
            await this.plugin.saveSettings();
          }
          this.refreshSettingsUI();
        }),
    );
  }

  private isLibraryMigrationAvailable(): boolean {
    return Boolean(
      this.plugin.settings.libraryStorageMode === "data-json" &&
        this.plugin.settings.libraryMigrationStatus !== "opted-out" &&
        this.plugin.stencilLibraryManager?.hasLegacyItems(),
    );
  }

  private configureLibraryMigrationSetting(setting: Setting): void {
    setting
      .setName(t("LIBRARY_MIGRATE_NOW"))
      .setDesc(t("LIBRARY_MIGRATE_NOW_DESC"))
      .addButton((button) =>
        button
          .setCta()
          .setButtonText(t("LIBRARY_MIGRATION_MIGRATE"))
          .onClick(async () => {
            await this.plugin.stencilLibraryManager?.showMigrationPrompt();
            this.refreshSettingsUI();
          }),
      );
  }

  private renderCheckpoint4ALegacyPages(): void {
    for (const page of this.getCheckpoint4APages()) {
      this.containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
      this.renderLegacyPage(this.containerEl, page, 1);
    }
  }

  private getSavingSpecs(): SettingSpec[] {
    return [
      {
        name: t("COMPRESS_NAME"),
        desc: fragWithHTML(t("COMPRESS_DESC")),
        control: { type: "toggle", key: "compress" },
      },
      {
        name: t("DECOMPRESS_FOR_MD_NAME"),
        desc: fragWithHTML(t("DECOMPRESS_FOR_MD_DESC")),
        control: { type: "toggle", key: "decompressForMDView" },
      },
      {
        name: t("AUTOSAVE_INTERVAL_DESKTOP_NAME"),
        desc: fragWithHTML(t("AUTOSAVE_INTERVAL_DESKTOP_DESC")),
        aliases: ["desktop autosave frequency"],
        control: {
          type: "number-dropdown",
          key: "autosaveIntervalDesktop",
          parse: "int",
          options: [
            { value: 15000, label: "Very frequent (every 15 seconds)" },
            { value: 30000, label: "Frequent (every 30 seconds)" },
            { value: 60000, label: "Moderate (every 60 seconds)" },
            { value: 300000, label: "Rare (every 5 minutes)" },
            { value: 900000, label: "Practically never (every 15 minutes)" },
          ],
        },
      },
      {
        name: t("AUTOSAVE_INTERVAL_MOBILE_NAME"),
        desc: fragWithHTML(t("AUTOSAVE_INTERVAL_MOBILE_DESC")),
        aliases: ["mobile autosave frequency"],
        control: {
          type: "number-dropdown",
          key: "autosaveIntervalMobile",
          parse: "int",
          options: [
            { value: 10000, label: "Very frequent (every 10 seconds)" },
            { value: 20000, label: "Frequent (every 20 seconds)" },
            { value: 30000, label: "Moderate (every 30 seconds)" },
            { value: 60000, label: "Rare (every 1 minute)" },
            { value: 300000, label: "Practically never (every 5 minutes)" },
          ],
        },
      },
    ];
  }

  private renderFilenameInformation(container: HTMLElement): void {
    const informationEl = container.createDiv(
      "excalidraw-filename-information",
    );
    informationEl.createDiv("", (el) => {
      setSanitizedHtml(el, t("FILENAME_DESC"));
    });
    this.filenameSampleEl = informationEl.createEl("p", { text: "" });
    setSanitizedHtml(this.filenameSampleEl, this.getFilenameSample());
  }

  private refreshFilenameSample(): void {
    if (this.filenameSampleEl?.isConnected) {
      setSanitizedHtml(this.filenameSampleEl, this.getFilenameSample());
    }
  }

  private getFilenameSpecs(): SettingSpec[] {
    return [
      {
        name: t("FILENAME_PREFIX_NAME"),
        desc: fragWithHTML(t("FILENAME_PREFIX_DESC")),
        aliases: ["base filename prefix", "drawing name prefix"],
        control: {
          type: "text",
          key: "drawingFilenamePrefix",
          placeholder: t("FILENAME_PREFIX_PLACEHOLDER"),
          sanitize: sanitizeFilenameSegment,
          after: () => this.refreshFilenameSample(),
        },
      },
      {
        name: t("FILENAME_PREFIX_EMBED_NAME"),
        desc: fragWithHTML(t("FILENAME_PREFIX_EMBED_DESC")),
        control: {
          type: "toggle",
          key: "drawingEmbedPrefixWithFilename",
          after: () => this.refreshFilenameSample(),
        },
      },
      {
        name: t("FILENAME_POSTFIX_NAME"),
        desc: fragWithHTML(t("FILENAME_POSTFIX_DESC")),
        aliases: ["embedded drawing filename postfix"],
        control: {
          type: "text",
          key: "drawingFilnameEmbedPostfix",
          sanitize: sanitizeFilenameSegment,
          after: () => this.refreshFilenameSample(),
        },
      },
      {
        name: t("FILENAME_DATE_NAME"),
        desc: fragWithHTML(t("FILENAME_DATE_DESC")),
        aliases: ["filename date format", "timestamp"],
        control: {
          type: "text",
          key: "drawingFilenameDateTime",
          placeholder: "YYYY-MM-DD HH.mm.ss",
          sanitize: sanitizeFilenameSegment,
          after: () => this.refreshFilenameSample(),
        },
      },
      {
        name: t("FILENAME_EXCALIDRAW_EXTENSION_NAME"),
        desc: fragWithHTML(t("FILENAME_EXCALIDRAW_EXTENSION_DESC")),
        aliases: [".excalidraw.md extension"],
        control: {
          type: "toggle",
          key: "useExcalidrawExtension",
          after: () => this.refreshFilenameSample(),
        },
      },
      {
        name: t("CROP_PREFIX_NAME"),
        desc: fragWithHTML(t("CROP_PREFIX_DESC")),
        aliases: ["cropped image filename prefix"],
        control: {
          type: "text",
          key: "cropPrefix",
          placeholder: t("CROP_PREFIX_PLACEHOLDER"),
          sanitize: sanitizeFilenameSegment,
        },
      },
      {
        name: t("CROP_SUFFIX_NAME"),
        desc: fragWithHTML(t("CROP_SUFFIX_DESC")),
        aliases: ["cropped image filename suffix"],
        control: {
          type: "text",
          key: "cropSuffix",
          placeholder: t("CROP_SUFFIX_PLACEHOLDER"),
          sanitize: sanitizeFilenameSegment,
        },
      },
      {
        name: t("ANNOTATE_PREFIX_NAME"),
        desc: fragWithHTML(t("ANNOTATE_PREFIX_DESC")),
        aliases: ["annotated image filename prefix"],
        control: {
          type: "text",
          key: "annotatePrefix",
          placeholder: t("ANNOTATE_PREFIX_PLACEHOLDER"),
          sanitize: sanitizeFilenameSegment,
        },
      },
      {
        name: t("ANNOTATE_SUFFIX_NAME"),
        desc: fragWithHTML(t("ANNOTATE_SUFFIX_DESC")),
        aliases: ["annotated image filename suffix"],
        control: {
          type: "text",
          key: "annotateSuffix",
          placeholder: t("ANNOTATE_SUFFIX_PLACEHOLDER"),
          sanitize: sanitizeFilenameSegment,
        },
      },
      {
        name: t("ANNOTATE_PRESERVE_SIZE_NAME"),
        desc: fragWithHTML(t("ANNOTATE_PRESERVE_SIZE_DESC")),
        control: { type: "toggle", key: "annotatePreserveSize" },
      },
    ];
  }

  private renderAISection(): void {
    const { containerEl } = this;
    let detailsEl: HTMLElement;
    //------------------------------------------------
    // AI Settings
    //------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({
      text: t("AI_DESC"),
      cls: "setting-item-description",
    });
    detailsEl = this.containerEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("AI_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    new Setting(detailsEl)
      .setName(t("AI_ENABLED_NAME"))
      .setDesc(fragWithHTML(t("AI_ENABLED_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.aiEnabled ?? true)
          .onChange(async (value) => {
            if (value) {
              showElement(aiEl);
            } else {
              hideElement(aiEl);
            }
            this.plugin.settings.aiEnabled = value;
            this.applySettingsUpdate();
          }),
      );

    detailsEl = detailsEl.createDiv();
    const aiEl = detailsEl;
    if (!(this.plugin.settings.aiEnabled ?? true)) {
      hideElement(detailsEl);
    }

    new Setting(detailsEl)
      .setName(t("AI_USAGE_SETTINGS_BUTTON_NAME"))
      .setDesc(t("AI_USAGE_SETTINGS_BUTTON_DESC"))
      .addButton((button) => {
        const updateLabel = () => {
          button.setButtonText(formatAIUsageLabel());
        };
        updateLabel();
        button.onClick(() => {
          updateLabel();
          new AIUsageModal(this.app, getAIUsage()).open();
        });
      });

    this.buildSetting(detailsEl, {
      name: t("AI_VERBOSE_LOGGING_NAME"),
      desc: fragWithHTML(t("AI_VERBOSE_LOGGING_DESC")),
      control: { type: "toggle", key: "aiVerboseLogging" },
    });

    let selectedProviderProfile =
      Object.keys(this.plugin.settings.aiProviderProfiles ?? {})[0] || "OpenAI";
    let selectedTextModelConfig =
      this.plugin.settings.aiDefaultTextModel?.trim() ||
      Object.keys(this.plugin.settings.aiTextModelConfigs ?? {})[0] ||
      "gpt-5-mini";
    let selectedImageModelConfig =
      this.plugin.settings.aiDefaultImageGenerationModel?.trim() ||
      Object.keys(this.plugin.settings.aiImageModelConfigs ?? {})[0] ||
      "gpt-image-1";

    const getProviderProfiles = () => {
      const profiles =
        this.plugin.settings.aiProviderProfiles &&
        Object.keys(this.plugin.settings.aiProviderProfiles).length > 0
          ? this.plugin.settings.aiProviderProfiles
          : cloneKnownAIProviderProfiles();
      return decryptProviderProfiles(profiles);
    };

    const getModelConfigs = (kind: "text" | "image") => {
      if (kind === "text") {
        if (
          this.plugin.settings.aiTextModelConfigs &&
          Object.keys(this.plugin.settings.aiTextModelConfigs).length > 0
        ) {
          return this.plugin.settings.aiTextModelConfigs;
        }

        return cloneModelConfigs(KNOWN_AI_TEXT_MODEL_CONFIGS);
      }

      if (
        this.plugin.settings.aiImageModelConfigs &&
        Object.keys(this.plugin.settings.aiImageModelConfigs).length > 0
      ) {
        return this.plugin.settings.aiImageModelConfigs;
      }

      return cloneModelConfigs(KNOWN_AI_IMAGE_MODEL_CONFIGS);
    };

    const setProviderProfiles = (
      profiles: Record<string, AIProviderProfile>,
    ) => {
      this.plugin.settings.aiProviderProfiles = Object.fromEntries(
        Object.entries(profiles).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      );
    };

    const setModelConfigs = (
      kind: "text" | "image",
      configs:
        | Record<string, AIModelConfig>
        | Record<string, AIImageModelConfig>,
    ) => {
      const sorted = Object.fromEntries(
        Object.entries(configs).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      );
      if (kind === "text") {
        this.plugin.settings.aiTextModelConfigs = sorted;
      }
      if (kind === "image") {
        this.plugin.settings.aiImageModelConfigs = sorted as Record<
          string,
          AIImageModelConfig
        >;
      }
    };

    const getValidSelection = (kind: "text" | "image") => {
      const configs = getModelConfigs(kind);
      const optionValues = Object.keys(configs);
      const selectedValue =
        kind === "text" ? selectedTextModelConfig : selectedImageModelConfig;
      if (selectedValue && configs[selectedValue]) {
        return selectedValue;
      }
      return optionValues[0] ?? "";
    };

    const providerContainer = detailsEl.createDiv();
    providerContainer.addClass("excalidraw-ai-provider-table");
    const textModelContainer = detailsEl.createDiv();
    const imageModelContainer = detailsEl.createDiv();

    const getProviderTypeLabel = (
      provider: "openai" | "anthropic" | "google" | "xai" | "openai-compatible",
    ) => {
      switch (provider) {
        case "anthropic":
          return t("AI_PROVIDER_OPTION_ANTHROPIC");
        case "google":
          return t("AI_PROVIDER_OPTION_GOOGLE");
        case "xai":
          return t("AI_PROVIDER_OPTION_XAI");
        case "openai-compatible":
          return t("AI_PROVIDER_OPTION_OPENAI_COMPATIBLE");
        default:
          return t("AI_PROVIDER_OPTION_OPENAI");
      }
    };

    const getApiStatusMarkup = (isConfigured: boolean) => {
      const color = isConfigured ? "var(--text-accent)" : "var(--text-error)";
      const label = isConfigured
        ? t("AI_PROVIDER_API_KEY_SET")
        : t("AI_PROVIDER_API_KEY_NOT_SET");
      return `<span style="color: ${color}; font-weight: 600;">${label}</span>`;
    };

    const updateModelProviderReferences = (
      previousProviderId: string,
      nextProviderId: string,
    ) => {
      (["text", "image"] as const).forEach((kind) => {
        const updatedConfigs = { ...getModelConfigs(kind) };
        let changed = false;
        Object.values(updatedConfigs).forEach((config) => {
          if (config.providerId === previousProviderId) {
            config.providerId = nextProviderId;
            changed = true;
          }
        });
        if (changed) {
          setModelConfigs(kind, updatedConfigs);
        }
      });
    };

    const openProviderProfileModal = (profileId?: string) => {
      const profiles = getProviderProfiles();
      new AIProviderProfileModal(
        this.app,
        Object.keys(profiles),
        async (nextProfileId, nextProfile, previousProfileId) => {
          const updatedProfiles = { ...getProviderProfiles() };
          if (previousProfileId && previousProfileId !== nextProfileId) {
            delete updatedProfiles[previousProfileId];
            updateModelProviderReferences(previousProfileId, nextProfileId);
          }
          updatedProfiles[nextProfileId] = { ...nextProfile };
          setProviderProfiles(updatedProfiles);
          selectedProviderProfile = nextProfileId;
          renderAISettings();
          this.applySettingsUpdate();
        },
        {
          previousProfileId: profileId,
          initialProfileId: profileId,
          initialProfile: profileId ? profiles[profileId] : undefined,
        },
      ).open();
    };

    const openModelConfigModal = (kind: "text" | "image", modelId?: string) => {
      const configs = getModelConfigs(kind);
      new AIModelConfigModal(
        this.app,
        Object.keys(configs),
        async (nextModelId, nextConfig, previousModelId) => {
          const updatedConfigs = { ...getModelConfigs(kind) };
          if (previousModelId && previousModelId !== nextModelId) {
            delete updatedConfigs[previousModelId];
          }
          updatedConfigs[nextModelId] = { ...nextConfig };
          if (kind === "text") {
            setModelConfigs(kind, updatedConfigs);
            selectedTextModelConfig = nextModelId;
            this.plugin.settings.aiDefaultTextModel = nextModelId;
            this.plugin.settings.aiDefaultMultimodalModel = nextModelId;
          }
          if (kind === "image") {
            setModelConfigs(kind, updatedConfigs);
            selectedImageModelConfig = nextModelId;
            this.plugin.settings.aiDefaultImageGenerationModel = nextModelId;
          }
          renderAISettings();
          this.applySettingsUpdate();
        },
        {
          kind,
          providerIds: Object.keys(getProviderProfiles()),
          providerProfiles: getProviderProfiles(),
          previousModelId: modelId,
          initialModelId: modelId,
          initialConfig: modelId ? configs[modelId] : undefined,
        },
      ).open();
    };

    const renderProviderSetting = () => {
      providerContainer.empty();
      const profiles = getProviderProfiles();
      const optionValues = Object.keys(profiles).sort((left, right) =>
        left.localeCompare(right),
      );
      if (!selectedProviderProfile || !profiles[selectedProviderProfile]) {
        selectedProviderProfile = optionValues[0] ?? "OpenAI";
      }
      const headerSetting = new Setting(providerContainer)
        .setName(t("AI_PROVIDER_NAME"))
        .setDesc(fragWithHTML(t("AI_PROVIDER_DESC")))
        .addExtraButton((button) => {
          button
            .setIcon("circle-plus")
            .setTooltip(t("AI_PROVIDER_ADD"))
            .onClick(() => openProviderProfileModal());
        })
        .addExtraButton((button) => {
          button
            .setIcon("rotate-ccw")
            .setTooltip(t("AI_PROVIDER_RESTORE_DEFAULTS"))
            .onClick(async () => {
              const restoredProfiles = cloneKnownAIProviderProfiles();
              setProviderProfiles(restoredProfiles);
              const fallbackProviderId =
                Object.keys(restoredProfiles)[0] ?? "OpenAI";
              (["text", "image"] as const).forEach((kind) => {
                const updatedConfigs = { ...getModelConfigs(kind) };
                let changed = false;
                Object.values(updatedConfigs).forEach((config) => {
                  if (!restoredProfiles[config.providerId]) {
                    config.providerId = fallbackProviderId;
                    changed = true;
                  }
                });
                if (changed) {
                  setModelConfigs(kind, updatedConfigs);
                }
              });
              selectedProviderProfile = fallbackProviderId;
              renderAISettings();
              this.applySettingsUpdate();
            });
        });
      headerSetting.settingEl.addClass("excalidraw-ai-provider-table__header");

      optionValues.forEach((providerId) => {
        const profile = profiles[providerId];
        const apiStatus = getApiStatusMarkup(Boolean(profile.apiKey?.trim()));
        const providerSetting = new Setting(providerContainer)
          .setName(providerId)
          .setDesc(
            fragWithHTML(
              t("AI_PROVIDER_PROFILE_ROW_DESC")
                .replace(
                  "{{providerType}}",
                  getProviderTypeLabel(profile.provider),
                )
                .replace("{{apiKey}}", apiStatus),
            ),
          )
          .addExtraButton((button) => {
            button
              .setIcon("pencil")
              .setTooltip(t("AI_PROVIDER_EDIT"))
              .onClick(() => openProviderProfileModal(providerId));
          })
          .addExtraButton((button) => {
            button
              .setIcon("trash")
              .setTooltip(t("AI_PROVIDER_REMOVE"))
              .setDisabled(optionValues.length <= 1)
              .onClick(async () => {
                const replacementProfileId =
                  optionValues.find((value) => value !== providerId) ??
                  optionValues[0];
                const updatedProfiles = { ...profiles };
                delete updatedProfiles[providerId];
                setProviderProfiles(updatedProfiles);
                updateModelProviderReferences(providerId, replacementProfileId);
                selectedProviderProfile = replacementProfileId;
                renderAISettings();
                this.applySettingsUpdate();
              });
          });
        providerSetting.settingEl.addClass("excalidraw-ai-provider-table__row");
      });
    };

    const renderModelSetting = (kind: "text" | "image") => {
      const container =
        kind === "text" ? textModelContainer : imageModelContainer;
      container.empty();
      const configs = getModelConfigs(kind);
      const optionValues = Object.keys(configs).sort((left, right) =>
        left.localeCompare(right),
      );
      const selectedValue = getValidSelection(kind);
      const config = configs[selectedValue];
      const providerProfile = getProviderProfiles()[config.providerId];
      const apiStatus = getApiStatusMarkup(
        Boolean(providerProfile?.apiKey?.trim()),
      );
      const getBooleanLabel = (value: boolean) =>
        value
          ? t("AI_IMAGE_MODEL_CAPABILITIES_EDITS_YES")
          : t("AI_IMAGE_MODEL_CAPABILITIES_EDITS_NO");
      const supportedSizes =
        kind === "image"
          ? getGeminiSupportedSizes(providerProfile?.provider, config.model)
          : [];

      const description =
        kind === "image"
          ? t("AI_PROVIDER_DEFAULT_IMAGE_MODEL_DESC")
              .replace("{{provider}}", config.providerId)
              .replace(
                "{{providerType}}",
                providerProfile
                  ? getProviderTypeLabel(providerProfile.provider)
                  : "",
              )
              .replace("{{apiKey}}", apiStatus)
              .replace("{{model}}", config.model)
              .replace(
                "{{sizes}}",
                (supportedSizes.length > 0
                  ? supportedSizes
                  : (config as AIImageModelConfig).supportedSizes
                ).join(", "),
              )
              .replace(
                "{{supportsPromptImageTransforms}}",
                getBooleanLabel(
                  (config as AIImageModelConfig).supportsPromptImageTransforms,
                ),
              )
              .replace(
                "{{supportsMaskImageEdits}}",
                getBooleanLabel(
                  (config as AIImageModelConfig).supportsMaskImageEdits,
                ),
              )
          : t("AI_PROVIDER_DEFAULT_TEXT_MODEL_DESC")
              .replace("{{provider}}", config.providerId)
              .replace("{{apiKey}}", apiStatus)
              .replace("{{model}}", config.model)
              .replace(
                "{{endpoint}}",
                config.endpoint?.trim() ||
                  t("AI_MODEL_CONFIG_DERIVED_ENDPOINT"),
              )
              .replace(
                "{{providerType}}",
                providerProfile
                  ? getProviderTypeLabel(providerProfile.provider)
                  : "",
              )
              .replace(
                "{{multimodalSupport}}",
                getBooleanLabel(config.multimodalSupport !== false),
              );

      new Setting(container)
        .setName(
          kind === "image"
            ? t("AI_PROVIDER_DEFAULT_IMAGE_MODEL_NAME")
            : t("AI_PROVIDER_DEFAULT_TEXT_MODEL_NAME"),
        )
        .setDesc(fragWithHTML(description))
        .addDropdown((dropdown) => {
          optionValues.forEach((value) => {
            void dropdown.addOption(value, value);
          });
          return dropdown.setValue(selectedValue).onChange((value) => {
            if (kind === "text") {
              selectedTextModelConfig = value;
              this.plugin.settings.aiDefaultTextModel = value;
              this.plugin.settings.aiDefaultMultimodalModel = value;
            }
            if (kind === "image") {
              selectedImageModelConfig = value;
              this.plugin.settings.aiDefaultImageGenerationModel = value;
            }
            renderAISettings();
            this.applySettingsUpdate();
          });
        })
        .addExtraButton((button) => {
          button
            .setIcon("pencil")
            .setTooltip(t("AI_MODEL_EDIT"))
            .onClick(() => openModelConfigModal(kind, selectedValue));
        })
        .addExtraButton((button) => {
          button
            .setIcon("circle-plus")
            .setTooltip(t("AI_MODEL_ADD"))
            .onClick(() => openModelConfigModal(kind));
        })
        .addExtraButton((button) => {
          button
            .setIcon("trash")
            .setTooltip(t("AI_MODEL_REMOVE"))
            .setDisabled(optionValues.length <= 1)
            .onClick(async () => {
              const updatedConfigs = { ...configs };
              delete updatedConfigs[selectedValue];
              setModelConfigs(kind, updatedConfigs);
              const nextSelection = Object.keys(getModelConfigs(kind))[0] ?? "";
              if (kind === "text") {
                selectedTextModelConfig = nextSelection;
                this.plugin.settings.aiDefaultTextModel = nextSelection;
                this.plugin.settings.aiDefaultMultimodalModel = nextSelection;
              }
              if (kind === "image") {
                selectedImageModelConfig = nextSelection;
                this.plugin.settings.aiDefaultImageGenerationModel =
                  nextSelection;
              }
              renderAISettings();
              this.applySettingsUpdate();
            });
        })
        .addExtraButton((button) => {
          button
            .setIcon("rotate-ccw")
            .setTooltip(t("AI_MODEL_RESTORE_DEFAULTS"))
            .onClick(async () => {
              if (kind === "text") {
                setModelConfigs(
                  kind,
                  cloneModelConfigs(KNOWN_AI_TEXT_MODEL_CONFIGS),
                );
              }
              if (kind === "image") {
                setModelConfigs(
                  kind,
                  cloneModelConfigs(KNOWN_AI_IMAGE_MODEL_CONFIGS),
                );
              }
              const nextSelection = Object.keys(getModelConfigs(kind))[0] ?? "";
              if (kind === "text") {
                selectedTextModelConfig = nextSelection;
                this.plugin.settings.aiDefaultTextModel = nextSelection;
                this.plugin.settings.aiDefaultMultimodalModel = nextSelection;
              }
              if (kind === "image") {
                selectedImageModelConfig = nextSelection;
                this.plugin.settings.aiDefaultImageGenerationModel =
                  nextSelection;
              }
              renderAISettings();
              this.applySettingsUpdate();
            });
        });
    };

    const renderAISettings = () => {
      renderProviderSetting();
      renderModelSetting("text");
      renderModelSetting("image");
    };

    const addNumberSetting = (
      parentEl: HTMLElement,
      name: string,
      desc: string,
      placeholder: string,
      getter: () => number,
      setter: (value: number) => void,
    ) => {
      new Setting(parentEl)
        .setName(name)
        .setDesc(fragWithHTML(desc))
        .addText((text) =>
          text
            .setPlaceholder(placeholder)
            .setValue(getter().toString())
            .onChange((value) => {
              const intVal = parseInt(value, 10);
              if (isNaN(intVal) && value !== "") {
                text.setValue(getter().toString());
                return;
              }
              if (value === "") {
                setter(0);
                text.setValue("0");
                this.applySettingsUpdate();
                return;
              }
              if (intVal < 0) {
                text.setValue(getter().toString());
                return;
              }
              setter(intVal);
              text.setValue(intVal.toString());
              this.applySettingsUpdate();
            }),
        );
    };

    renderAISettings();

    addNumberSetting(
      detailsEl,
      t("AI_PROVIDER_DEFAULT_MAX_OUTGOING_TOKENS_NAME"),
      t("AI_PROVIDER_DEFAULT_MAX_OUTGOING_TOKENS_DESC"),
      t("AI_PROVIDER_DEFAULT_MAX_OUTGOING_TOKENS_PLACEHOLDER"),
      () => this.plugin.settings.aiDefaultMaxOutgoingTokens,
      (value) => {
        this.plugin.settings.aiDefaultMaxOutgoingTokens = value;
      },
    );

    addNumberSetting(
      detailsEl,
      t("AI_PROVIDER_DEFAULT_MAX_RESPONSE_TOKENS_NAME"),
      t("AI_PROVIDER_DEFAULT_MAX_RESPONSE_TOKENS_DESC"),
      t("AI_PROVIDER_DEFAULT_MAX_RESPONSE_TOKENS_PLACEHOLDER"),
      () => this.plugin.settings.aiDefaultMaxResponseTokens,
      (value) => {
        this.plugin.settings.aiDefaultMaxResponseTokens = value;
      },
    );

  }

  private renderDisplaySection(): void {
    const { containerEl } = this;
    let detailsEl: HTMLElement;
    // ------------------------------------------------
    // Display
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({
      text: t("DISPLAY_DESC"),
      cls: "setting-item-description",
    });
    detailsEl = this.containerEl.createEl("details");
    const displayDetailsEl = detailsEl;
    detailsEl.createEl("summary", {
      text: t("DISPLAY_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    this.buildSetting(detailsEl, {
      name: t("ENABLE_DOUBLE_CLICK_TEXT_EDITING_NAME"),
      control: {
        type: "toggle",
        key: "disableDoubleClickTextEditing",
        negate: true,
      },
    });

    this.buildSetting(detailsEl, {
      name: t("DISABLE_CONTEXT_MENU_NAME"),
      desc: t("DISABLE_CONTEXT_MENU_DESC"),
      control: { type: "toggle", key: "disableContextMenu", negate: true },
    });

    const readingModeEl = this.buildSetting(detailsEl, {
      name: t("SHOW_DRAWING_OR_MD_IN_READING_MODE_NAME"),
      desc: fragWithHTML(t("SHOW_DRAWING_OR_MD_IN_READING_MODE_DESC")),
      control: { type: "toggle", key: "renderImageInMarkdownReadingMode" },
    });
    readingModeEl.nameEl.setAttribute("id", TAG_MDREADINGMODE);

    this.buildSetting(detailsEl, {
      name: t("SHOW_DRAWING_OR_MD_IN_HOVER_PREVIEW_NAME"),
      desc: fragWithHTML(t("SHOW_DRAWING_OR_MD_IN_HOVER_PREVIEW_DESC")),
      control: { type: "toggle", key: "renderImageInHoverPreviewForMDNotes" },
    });

    detailsEl = displayDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("MODES_HEAD"),
      cls: "excalidraw-setting-h3",
    });

    this.buildSetting(detailsEl, {
      name: t("SHOW_TAB_TITLEBAR_BUTTONS"),
      control: {
        type: "toggle",
        key: "showTabTitlebarButtons",
        afterUpdate: (value) => {
          getExcalidrawViews(this.app, true).forEach((excalidrawView) => {
            if (value) {
              excalidrawView.addTabTitlebarButtons();
            } else {
              excalidrawView.removeTabTitlebarButtons();
            }
          });
        },
      },
    });

    new UIModeSettingsComponent(detailsEl, this.plugin.settings, this.app, () =>
      this.applySettingsUpdate(),
    ).render();
    addYouTubeThumbnail(detailsEl, "H8Njp7ZXYag", 999);

    detailsEl = displayDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("HOTKEY_OVERRIDE_HEAD"),
      cls: "excalidraw-setting-h3",
    });
    detailsEl.createSpan({}, (el) => {
      setSanitizedHtml(el, t("HOTKEY_OVERRIDE_DESC"));
    });

    this.hotkeyEditor = new HotkeyEditor(
      detailsEl,
      this.plugin.settings,
      (x: boolean = false) => this.applySettingsUpdate(x),
    );
    this.hotkeyEditor.onload();

    detailsEl = displayDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("THEME_HEAD"),
      cls: "excalidraw-setting-h3",
    });

    this.buildSetting(detailsEl, {
      name: t("OVERRIDE_OBSIDIAN_FONT_SIZE_NAME"),
      desc: fragWithHTML(t("OVERRIDE_OBSIDIAN_FONT_SIZE_DESC")),
      control: { type: "toggle", key: "overrideObsidianFontSize" },
    });

    this.buildSetting(detailsEl, {
      name: t("DYNAMICSTYLE_NAME"),
      desc: fragWithHTML(t("DYNAMICSTYLE_DESC")),
      control: {
        type: "dropdown",
        key: "dynamicStyling",
        before: () => {
          this.requestUpdateDynamicStyling = true;
        },
        options: [
          { value: "none", label: t("DYNAMICSTYLE_OPTION_NONE") },
          { value: "colorful", label: t("DYNAMICSTYLE_OPTION_COLORFUL") },
          { value: "gray", label: t("DYNAMICSTYLE_OPTION_GRAY") },
        ],
      },
    });
    addYouTubeThumbnail(detailsEl, "fypDth_-8q0");

    this.buildSetting(detailsEl, {
      name: t("IFRAME_MATCH_THEME_NAME"),
      desc: fragWithHTML(t("IFRAME_MATCH_THEME_DESC")),
      control: { type: "toggle", key: "iframeMatchExcalidrawTheme", reload: true },
    });
    addYouTubeThumbnail(detailsEl, "ICpoyMv6KSs");

    this.buildSetting(detailsEl, {
      name: t("MATCH_THEME_NAME"),
      desc: fragWithHTML(t("MATCH_THEME_DESC")),
      control: { type: "toggle", key: "matchTheme" },
    });

    this.buildSetting(detailsEl, {
      name: t("MATCH_THEME_ALWAYS_NAME"),
      desc: fragWithHTML(t("MATCH_THEME_ALWAYS_DESC")),
      control: { type: "toggle", key: "matchThemeAlways" },
    });

    this.buildSetting(detailsEl, {
      name: t("MATCH_THEME_TRIGGER_NAME"),
      desc: fragWithHTML(t("MATCH_THEME_TRIGGER_DESC")),
      control: {
        type: "toggle",
        key: "matchThemeTrigger",
        after: (value) => {
          if (value) {
            this.plugin.addThemeObserver();
          } else {
            this.plugin.removeThemeObserver();
          }
        },
      },
    });

    this.buildSetting(detailsEl, {
      name: t("DEFAULT_OPEN_MODE_NAME"),
      desc: fragWithHTML(t("DEFAULT_OPEN_MODE_DESC")),
      control: {
        type: "dropdown",
        key: "defaultMode",
        options: [
          { value: "normal", label: t("DEFAULT_OPEN_MODE_OPTION_NORMAL") },
          { value: "zen", label: t("DEFAULT_OPEN_MODE_OPTION_ZEN") },
          { value: "view", label: t("DEFAULT_OPEN_MODE_OPTION_VIEW") },
          {
            value: "view-mobile",
            label: t("DEFAULT_OPEN_MODE_OPTION_VIEW_MOBILE"),
          },
        ],
      },
    });

    this.buildSetting(detailsEl, {
      name: t("PHONE_FOOTER_SAFE_AREA_PADDING_NAME"),
      desc: fragWithHTML(t("PHONE_FOOTER_SAFE_AREA_PADDING_DESC")),
      control: {
        type: "toggle",
        key: "phoneFooterSafeAreaPadding",
        after: () => this.plugin.updateFooterSafeAreaPadding(),
      },
    });

    this.buildSetting(detailsEl, {
      name: t("TABLET_FOOTER_SAFE_AREA_PADDING_NAME"),
      desc: fragWithHTML(t("TABLET_FOOTER_SAFE_AREA_PADDING_DESC")),
      control: {
        type: "toggle",
        key: "tabletFooterSafeAreaPadding",
        after: () => this.plugin.updateFooterSafeAreaPadding(),
      },
    });

    detailsEl = displayDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("ZOOM_AND_PAN_HEAD"), //mfuria #329
      cls: "excalidraw-setting-h3",
    });

    //mfuria #329. Added setting for right-click panning
    this.buildSetting(detailsEl, {
      name: t("PAN_WITH_RIGHT_MOUSE_BUTTON_NAME"),
      desc: fragWithHTML(t("PAN_WITH_RIGHT_MOUSE_BUTTON_DESC")),
      control: { type: "toggle", key: "panWithRightMouseButton", reload: true },
    });

    this.buildSetting(detailsEl, {
      name: t("DEFAULT_PINCHZOOM_NAME"),
      desc: fragWithHTML(t("DEFAULT_PINCHZOOM_DESC")),
      control: {
        type: "toggle",
        key: "allowPinchZoom",
        after: () =>
          getExcalidrawViews(this.app, true).forEach((excalidrawView) =>
            excalidrawView.updatePinchZoom(),
          ),
      },
    });
    addYouTubeThumbnail(detailsEl, "rBarRfcSxNo", 107);

    this.buildSetting(detailsEl, {
      name: t("DEFAULT_WHEELZOOM_NAME"),
      desc: fragWithHTML(t("DEFAULT_WHEELZOOM_DESC")),
      control: {
        type: "toggle",
        key: "allowWheelZoom",
        after: () =>
          getExcalidrawViews(this.app, true).forEach((excalidrawView) =>
            excalidrawView.updateWheelZoom(),
          ),
      },
    });

    this.buildSetting(detailsEl, {
      name: t("ZOOM_TO_FIT_ONOPEN_NAME"),
      desc: fragWithHTML(t("ZOOM_TO_FIT_ONOPEN_DESC")),
      control: { type: "toggle", key: "zoomToFitOnOpen" },
    });

    this.buildSetting(detailsEl, {
      name: t("ZOOM_TO_FIT_NAME"),
      desc: fragWithHTML(t("ZOOM_TO_FIT_DESC")),
      control: { type: "toggle", key: "zoomToFitOnResize" },
    });

    this.buildSetting(detailsEl, {
      name: t("ZOOM_TO_FIT_MAX_LEVEL_NAME"),
      desc: t("ZOOM_TO_FIT_MAX_LEVEL_DESC"),
      control: {
        type: "slider",
        key: "zoomToFitMaxLevel",
        min: 0.5,
        max: 10,
        step: 0.5,
      },
    });

    this.buildSetting(detailsEl, {
      name: t("ZOOM_STEP_NAME"),
      desc: t("ZOOM_STEP_DESC"),
      control: {
        type: "slider",
        key: "zoomStep",
        min: 1,
        max: 25,
        step: 1,
        scale: 100,
      },
    });

    this.buildSetting(detailsEl, {
      name: t("ZOOM_MIN_NAME"),
      desc: t("ZOOM_MIN_DESC"),
      control: {
        type: "slider",
        key: "zoomMin",
        min: 1,
        max: 50,
        step: 1,
        scale: 100,
      },
    });

    this.buildSetting(detailsEl, {
      name: t("ZOOM_MAX_NAME"),
      desc: t("ZOOM_MAX_DESC"),
      control: {
        type: "slider",
        key: "zoomMax",
        min: 500,
        max: 6000,
        step: 100,
        scale: 100,
      },
    });

    // ------------------------------------------------
    // Pen
    // ------------------------------------------------
    detailsEl = displayDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("PEN_HEAD"),
      cls: "excalidraw-setting-h3",
    });

    this.buildSetting(detailsEl, {
      name: t("DEFAULT_PEN_MODE_NAME"),
      desc: fragWithHTML(t("DEFAULT_PEN_MODE_DESC")),
      control: {
        type: "dropdown",
        key: "defaultPenMode",
        options: [
          { value: "never", label: t("DEFAULT_PEN_MODE_OPTION_NEVER") },
          { value: "mobile", label: t("DEFAULT_PEN_MODE_OPTION_MOBILE") },
          { value: "always", label: t("DEFAULT_PEN_MODE_OPTION_ALWAYS") },
        ],
      },
    });

    this.buildSetting(detailsEl, {
      name: t("DISABLE_DOUBLE_TAP_ERASER_NAME"),
      control: { type: "toggle", key: "penModeDoubleTapEraser" },
    });

    this.buildSetting(detailsEl, {
      name: t("DISABLE_SINGLE_FINGER_PANNING_NAME"),
      control: { type: "toggle", key: "penModeSingleFingerPanning" },
    });

    this.buildSetting(detailsEl, {
      name: t("SHOW_PEN_MODE_FREEDRAW_CROSSHAIR_NAME"),
      desc: fragWithHTML(t("SHOW_PEN_MODE_FREEDRAW_CROSSHAIR_DESC")),
      control: { type: "toggle", key: "penModeCrosshairVisible" },
    });

    // ------------------------------------------------
    // Grid
    // ------------------------------------------------
    detailsEl = displayDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("GRID_HEAD"),
      cls: "excalidraw-setting-h3",
    });

    const updateGridColor = () => {
      getExcalidrawViews(this.app, true).forEach((excalidrawView) =>
        excalidrawView.updateGridColor(),
      );
    };

    const updateGridDirection = () => {
      getExcalidrawViews(this.app, true).forEach((excalidrawView) =>
        excalidrawView.updateGridDirection(
          this.plugin.settings.gridSettings.GRID_DIRECTION,
        ),
      );
    };

    new Setting(detailsEl)
      .setName(t("GRID_DIRECTION_NAME"))
      .setDesc(t("GRID_DIRECTION_DESC"))
      .addToggle((toggle) =>
        toggle
          .setTooltip(t("GRID_HORIZONTAL"))
          .setValue(
            this.plugin.settings.gridSettings.GRID_DIRECTION?.horizontal ??
              true,
          )
          .onChange((value) => {
            if (!this.plugin.settings.gridSettings.GRID_DIRECTION) {
              this.plugin.settings.gridSettings.GRID_DIRECTION = {
                horizontal: true,
                vertical: true,
              };
            } //2.10.1 migration
            this.plugin.settings.gridSettings.GRID_DIRECTION.horizontal = value;
            this.applySettingsUpdate();
            updateGridDirection();
          }),
      )
      .addToggle((toggle) =>
        toggle
          .setTooltip(t("GRID_VERTICAL"))
          .setValue(
            this.plugin.settings.gridSettings.GRID_DIRECTION?.vertical ?? true,
          )
          .onChange((value) => {
            if (!this.plugin.settings.gridSettings.GRID_DIRECTION) {
              this.plugin.settings.gridSettings.GRID_DIRECTION = {
                horizontal: true,
                vertical: true,
              };
            } //2.10.1 migration
            this.plugin.settings.gridSettings.GRID_DIRECTION.vertical = value;
            this.applySettingsUpdate();
            updateGridDirection();
          }),
      );

    // Dynamic color toggle
    new Setting(detailsEl)
      .setName(t("GRID_DYNAMIC_COLOR_NAME"))
      .setDesc(fragWithHTML(t("GRID_DYNAMIC_COLOR_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.gridSettings.DYNAMIC_COLOR)
          .onChange(async (value) => {
            this.plugin.settings.gridSettings.DYNAMIC_COLOR = value;
            if (value) {
              hideElement(gridColorSection);
            } else {
              showElement(gridColorSection);
            }
            this.applySettingsUpdate();
            updateGridColor();
          }),
      );

    // Create a div to contain color and opacity settings
    const gridColorSection = detailsEl.createDiv();
    if (this.plugin.settings.gridSettings.DYNAMIC_COLOR) {
      hideElement(gridColorSection);
    } else {
      showElement(gridColorSection);
    }

    // Grid color picker
    new Setting(gridColorSection)
      .setName(t("GRID_COLOR_NAME"))
      .addColorPicker((colorPicker) =>
        colorPicker
          .setValue(this.plugin.settings.gridSettings.COLOR)
          .onChange(async (value) => {
            this.plugin.settings.gridSettings.COLOR = value;
            this.applySettingsUpdate();
            updateGridColor();
          }),
      );

    // Grid opacity slider (hex value between 00 and FF)
    createSliderWithText(detailsEl, {
      name: t("GRID_OPACITY_NAME"),
      desc: t("GRID_OPACITY_DESC"),
      value: this.plugin.settings.gridSettings.OPACITY,
      min: 0,
      max: 100,
      step: 1,
      onChange: (value) => {
        this.plugin.settings.gridSettings.OPACITY = value;
        this.applySettingsUpdate();
        updateGridColor();
      },
      minWidth: "3em",
    });

    // ------------------------------------------------
    // Laser Pointer
    // ------------------------------------------------
    detailsEl = displayDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("LASER_HEAD"),
      cls: "excalidraw-setting-h3",
    });
    new Setting(detailsEl)
      .setName(t("LASER_COLOR"))
      .addColorPicker((colorPicker) =>
        colorPicker
          .setValue(this.plugin.settings.laserSettings.COLOR)
          .onChange(async (value) => {
            this.plugin.settings.laserSettings.COLOR = value;
            this.applySettingsUpdate();
          }),
      );

    createSliderWithText(detailsEl, {
      name: t("LASER_DECAY_TIME_NAME"),
      desc: t("LASER_DECAY_TIME_DESC"),
      value: this.plugin.settings.laserSettings.DECAY_TIME,
      min: 500,
      max: 20000,
      step: 500,
      onChange: (value) => {
        this.plugin.settings.laserSettings.DECAY_TIME = value;
        this.applySettingsUpdate();
      },
      minWidth: "3em",
    });

    createSliderWithText(detailsEl, {
      name: t("LASER_DECAY_LENGTH_NAME"),
      desc: t("LASER_DECAY_LENGTH_DESC"),
      value: this.plugin.settings.laserSettings.DECAY_LENGTH,
      min: 25,
      max: 2000,
      step: 25,
      onChange: (value) => {
        this.plugin.settings.laserSettings.DECAY_LENGTH = value;
        this.applySettingsUpdate();
      },
      minWidth: "3em",
    });

    detailsEl = displayDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("DRAG_MODIFIER_NAME"),
      cls: "excalidraw-setting-h3",
    });
    detailsEl.createDiv({
      text: t("DRAG_MODIFIER_DESC"),
      cls: "setting-item-description",
    });

    this.buildSetting(detailsEl, {
      name: t("LONG_PRESS_DESKTOP_NAME"),
      desc: t("LONG_PRESS_DESKTOP_DESC"),
      control: {
        type: "slider",
        key: "longPressDesktop",
        min: 300,
        max: 3000,
        step: 100,
        reload: true,
      },
    });

    this.buildSetting(detailsEl, {
      name: t("LONG_PRESS_MOBILE_NAME"),
      desc: t("LONG_PRESS_MOBILE_DESC"),
      control: {
        type: "slider",
        key: "longPressMobile",
        min: 300,
        max: 3000,
        step: 100,
        reload: true,
      },
    });

    this.buildSetting(detailsEl, {
      name: t("DOUBLE_CLICK_LINK_OPEN_VIEW_MODE"),
      control: { type: "toggle", key: "doubleClickLinkOpenViewMode" },
    });

    new ModifierKeySettingsComponent(
      detailsEl,
      this.plugin.settings.modifierKeyConfig,
      () => this.applySettingsUpdate(),
    ).render();

  }

  private renderLinksAndTransclusionsSection(): void {
    const { containerEl } = this;
    let detailsEl: HTMLElement;
    // ------------------------------------------------
    // Links and Transclusions
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({
      text: t("LINKS_HEAD_DESC"),
      cls: "setting-item-description",
    });
    detailsEl = this.containerEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("LINKS_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    detailsEl.createSpan(undefined, (el) =>
      setSanitizedHtml(el, t("LINKS_DESC")),
    );

    this.buildSetting(detailsEl, {
      name: t("ELEMENT_LINK_SYNC_NAME"),
      desc: fragWithHTML(t("ELEMENT_LINK_SYNC_DESC")),
      control: { type: "toggle", key: "syncElementLinkWithText" },
    });

    this.buildSetting(detailsEl, {
      name: t("SECOND_ORDER_LINKS_NAME"),
      desc: fragWithHTML(t("SECOND_ORDER_LINKS_DESC")),
      control: { type: "toggle", key: "showSecondOrderLinks" },
    });

    this.buildSetting(detailsEl, {
      name: t("ADJACENT_PANE_NAME"),
      desc: fragWithHTML(t("ADJACENT_PANE_DESC")),
      control: { type: "toggle", key: "openInAdjacentPane" },
    });

    this.buildSetting(detailsEl, {
      name: t("FOCUS_ON_EXISTING_TAB_NAME"),
      desc: fragWithHTML(t("FOCUS_ON_EXISTING_TAB_DESC")),
      control: { type: "toggle", key: "focusOnFileTab" },
    });

    this.buildSetting(detailsEl, {
      name: t("MAINWORKSPACE_PANE_NAME"),
      desc: fragWithHTML(t("MAINWORKSPACE_PANE_DESC")),
      control: { type: "toggle", key: "openInMainWorkspace" },
    });

    this.buildSetting(detailsEl, {
      name: fragWithHTML(t("LINK_BRACKETS_NAME")),
      desc: fragWithHTML(t("LINK_BRACKETS_DESC")),
      control: { type: "toggle", key: "showLinkBrackets", reload: true },
    });

    this.buildSetting(detailsEl, {
      name: t("LINK_PREFIX_NAME"),
      desc: fragWithHTML(t("LINK_PREFIX_DESC")),
      control: {
        type: "text",
        key: "linkPrefix",
        placeholder: t("INSERT_EMOJI"),
        reload: true,
      },
    });

    this.buildSetting(detailsEl, {
      name: t("URL_PREFIX_NAME"),
      desc: fragWithHTML(t("URL_PREFIX_DESC")),
      control: {
        type: "text",
        key: "urlPrefix",
        placeholder: t("INSERT_EMOJI"),
        reload: true,
      },
    });

    let todoPrefixSetting: TextComponent;
    let donePrefixSetting: TextComponent;

    this.buildSetting(detailsEl, {
      name: t("PARSE_TODO_NAME"),
      desc: fragWithHTML(t("PARSE_TODO_DESC")),
      control: {
        type: "toggle",
        key: "parseTODO",
        after: (value) => {
          todoPrefixSetting.setDisabled(!value);
          donePrefixSetting.setDisabled(!value);
        },
        reload: true,
      },
    });

    this.buildSetting(detailsEl, {
      name: t("TODO_NAME"),
      desc: fragWithHTML(t("TODO_DESC")),
      control: {
        type: "text",
        key: "todo",
        placeholder: t("INSERT_EMOJI"),
        capture: (text) => {
          todoPrefixSetting = text;
        },
        reload: true,
      },
    });
    todoPrefixSetting.setDisabled(!this.plugin.settings.parseTODO);

    const doneSetting = this.buildSetting(detailsEl, {
      name: t("DONE_NAME"),
      desc: fragWithHTML(t("DONE_DESC")),
      control: {
        type: "text",
        key: "done",
        placeholder: t("INSERT_EMOJI"),
        capture: (text) => {
          donePrefixSetting = text;
        },
        reload: true,
      },
    });
    doneSetting?.setDisabled(!this.plugin.settings.parseTODO);
    donePrefixSetting.setDisabled(!this.plugin.settings.parseTODO);

    this.buildSetting(detailsEl, {
      name: t("LINKOPACITY_NAME"),
      desc: t("LINKOPACITY_DESC"),
      control: {
        type: "slider",
        key: "linkOpacity",
        min: 0,
        max: 1,
        step: 0.05,
        reload: true,
      },
    });

    this.buildSetting(detailsEl, {
      name: t("HOVERPREVIEW_NAME"),
      desc: fragWithHTML(t("HOVERPREVIEW_DESC")),
      control: { type: "toggle", key: "hoverPreviewWithoutCTRL" },
    });

    this.buildSetting(detailsEl, {
      name: t("LINK_CTRL_CLICK_NAME"),
      desc: fragWithHTML(t("LINK_CTRL_CLICK_DESC")),
      control: { type: "toggle", key: "allowCtrlClick" },
    });

    const s = this.buildSetting(detailsEl, {
      name: t("TRANSCLUSION_WRAP_NAME"),
      desc: fragWithHTML(t("TRANSCLUSION_WRAP_DESC")),
      control: { type: "toggle", key: "forceWrap", reload: true },
    });
    setSanitizedHtml(
      s.descEl,
      `<code>![[doc#^ref]]{number}</code> ${t("TRANSCLUSION_WRAP_DESC")}`,
    );

    new Setting(detailsEl)
      .setName(t("PAGE_TRANSCLUSION_CHARCOUNT_NAME"))
      .setDesc(fragWithHTML(t("PAGE_TRANSCLUSION_CHARCOUNT_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("Enter a number")
          .setValue(this.plugin.settings.pageTransclusionCharLimit.toString())
          .onChange(async (value) => {
            const intVal = parseInt(value);
            if (isNaN(intVal) && value !== "") {
              text.setValue(
                this.plugin.settings.pageTransclusionCharLimit.toString(),
              );
              return;
            }
            this.requestEmbedUpdate = true;
            if (value === "") {
              this.plugin.settings.pageTransclusionCharLimit = 10;
              this.applySettingsUpdate(true);
              return;
            }
            this.plugin.settings.pageTransclusionCharLimit = intVal;
            text.setValue(
              this.plugin.settings.pageTransclusionCharLimit.toString(),
            );
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(detailsEl)
      .setName(t("TRANSCLUSION_DEFAULT_WRAP_NAME"))
      .setDesc(fragWithHTML(t("TRANSCLUSION_DEFAULT_WRAP_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("Enter a number")
          .setValue(this.plugin.settings.wordWrappingDefault.toString())
          .onChange(async (value) => {
            const intVal = parseInt(value);
            if (isNaN(intVal) && value !== "") {
              text.setValue(
                this.plugin.settings.wordWrappingDefault.toString(),
              );
              return;
            }
            this.requestEmbedUpdate = true;
            if (value === "") {
              this.plugin.settings.wordWrappingDefault = 0;
              this.applySettingsUpdate(true);
              return;
            }
            this.plugin.settings.wordWrappingDefault = intVal;
            text.setValue(this.plugin.settings.wordWrappingDefault.toString());
            this.applySettingsUpdate(true);
          }),
      );

    this.buildSetting(detailsEl, {
      name: t("QUOTE_TRANSCLUSION_REMOVE_NAME"),
      desc: fragWithHTML(t("QUOTE_TRANSCLUSION_REMOVE_DESC")),
      control: {
        type: "toggle",
        key: "removeTransclusionQuoteSigns",
        after: () => {
          this.requestEmbedUpdate = true;
        },
        reload: true,
      },
    });

    this.buildSetting(detailsEl, {
      name: t("GET_URL_TITLE_NAME"),
      desc: fragWithHTML(t("GET_URL_TITLE_DESC")),
      control: { type: "toggle", key: "oEmbedAllowed" },
    });

  }

  private renderEmbedAndExportSection(): void {
    const { containerEl } = this;
    let detailsEl: HTMLElement;
    // ------------------------------------------------
    // Embed and Export
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({
      text: t("EMBED_DESC"),
      cls: "setting-item-description",
    });
    detailsEl = this.containerEl.createEl("details");
    const embedDetailsEl = detailsEl;
    detailsEl.createEl("summary", {
      text: t("EMBED_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    this.buildSetting(detailsEl, {
      name: t("EMBED_PREVIEW_IMAGETYPE_NAME"),
      desc: fragWithHTML(t("EMBED_PREVIEW_IMAGETYPE_DESC")),
      control: {
        type: "dropdown",
        key: "previewImageType",
        after: () => {
          this.requestEmbedUpdate = true;
        },
        options: [
          {
            value: PreviewImageType.PNG,
            label: t("EMBED_PREVIEW_IMAGETYPE_OPTION_PNG"),
          },
          {
            value: PreviewImageType.SVG,
            label: t("EMBED_PREVIEW_IMAGETYPE_OPTION_SVG"),
          },
          {
            value: PreviewImageType.SVGIMG,
            label: t("EMBED_PREVIEW_IMAGETYPE_OPTION_SVGIMG"),
          },
        ],
      },
    });
    addYouTubeThumbnail(detailsEl, "yZQoJg2RCKI");
    addYouTubeThumbnail(detailsEl, "opLd1SqaH_I", 8);

    let dropdown: DropdownComponent;
    new Setting(detailsEl)
      .setName(t("EMBED_TYPE_NAME"))
      .setDesc(fragWithHTML(t("EMBED_TYPE_DESC")))
      .addDropdown(async (d: DropdownComponent) => {
        dropdown = d;
        dropdown.addOption("excalidraw", "Excalidraw");
        if (this.plugin.settings.autoexportPNG) {
          dropdown.addOption("PNG", "PNG");
        } else if (this.plugin.settings.embedType === "PNG") {
          this.plugin.settings.embedType = "excalidraw";
          this.applySettingsUpdate();
        }
        if (this.plugin.settings.autoexportSVG) {
          dropdown.addOption("SVG", "SVG");
        } else if (this.plugin.settings.embedType === "SVG") {
          this.plugin.settings.embedType = "excalidraw";
          this.applySettingsUpdate();
        }
        dropdown
          .setValue(this.plugin.settings.embedType)
          .onChange(async (value) => {
            this.plugin.settings.embedType =
              value as typeof this.plugin.settings.embedType;
            if (value === "excalidraw") {
              hideElement(embedComment.settingEl);
            } else {
              showElement(embedComment.settingEl);
            }
            this.applySettingsUpdate();
          });
      });

    const embedComment = this.buildSetting(detailsEl, {
      name: t("EMBED_MARKDOWN_COMMENT_NAME"),
      desc: fragWithHTML(t("EMBED_MARKDOWN_COMMENT_DESC")),
      control: { type: "toggle", key: "embedMarkdownCommentLinks" },
    });

    if (this.plugin.settings.embedType === "excalidraw") {
      hideElement(embedComment.settingEl);
    } else {
      showElement(embedComment.settingEl);
    }

    this.buildSetting(detailsEl, {
      name: t("EMBED_WIKILINK_NAME"),
      desc: fragWithHTML(t("EMBED_WIKILINK_DESC")),
      control: { type: "toggle", key: "embedWikiLink" },
    });

    // Embed placeholder image setting
    this.buildSetting(detailsEl, {
      name: t("EMBED_PLACEHOLDER_NAME"),
      desc: fragWithHTML(t("EMBED_PLACEHOLDER_DESC")),
      control: { type: "toggle", key: "embedPlaceholderImage" },
    });
    detailsEl = embedDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("EMBED_CANVAS"),
      cls: "excalidraw-setting-h3",
    });

    this.buildSetting(detailsEl, {
      name: t("EMBED_CANVAS_NAME"),
      desc: fragWithHTML(t("EMBED_CANVAS_DESC")),
      control: { type: "toggle", key: "canvasImmersiveEmbed" },
    });

    detailsEl = embedDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("EMBED_CACHING"),
      cls: "excalidraw-setting-h3",
    });

    this.buildSetting(detailsEl, {
      name: t("RENDERING_CONCURRENCY_NAME"),
      desc: t("RENDERING_CONCURRENCY_DESC"),
      control: {
        type: "slider",
        key: "renderingConcurrency",
        min: 1,
        max: 5,
        step: 1,
      },
    });

    this.buildSetting(detailsEl, {
      name: t("IMAGE_CACHE_RETENTION_DAYS_NAME"),
      desc: fragWithHTML(t("IMAGE_CACHE_RETENTION_DAYS_DESC")),
      control: {
        type: "slider",
        key: "imageCacheRetentionDays",
        min: 1,
        max: 365,
        step: 1,
        minWidth: "3em",
      },
    });

    this.buildSetting(detailsEl, {
      name: t("EMBED_IMAGE_CACHE_NAME"),
      desc: fragWithHTML(t("EMBED_IMAGE_CACHE_DESC")),
      control: { type: "toggle", key: "allowImageCache" },
    });
    this.buildSetting(detailsEl, {
      name: t("SCENE_IMAGE_CACHE_NAME"),
      desc: fragWithHTML(t("SCENE_IMAGE_CACHE_DESC")),
      control: { type: "toggle", key: "allowImageCacheInScene" },
    });
    new Setting(detailsEl)
      .setName(t("EMBED_IMAGE_CACHE_CLEAR"))
      .addButton((button) =>
        button.setButtonText(t("EMBED_IMAGE_CACHE_CLEAR")).onClick(() => {
          void getImageCache().clearImageCache();
        }),
      );
    new Setting(detailsEl)
      .setName(t("BACKUP_CACHE_CLEAR"))
      .addButton((button) =>
        button.setButtonText(t("BACKUP_CACHE_CLEAR")).onClick(() => {
          const confirmationPrompt = new MultiOptionConfirmationPrompt(
            this.plugin,
            t("BACKUP_CACHE_CLEAR_CONFIRMATION"),
          );
          void confirmationPrompt.waitForClose.then((confirmed) => {
            if (confirmed) {
              void getImageCache().clearBackupCache();
            }
          });
        }),
      );

    this.buildSetting(detailsEl, {
      name: t("EMBED_REUSE_EXPORTED_IMAGE_NAME"),
      desc: fragWithHTML(t("EMBED_REUSE_EXPORTED_IMAGE_DESC")),
      control: { type: "toggle", key: "displayExportedImageIfAvailable" },
    });

    detailsEl = embedDetailsEl.createEl("details");
    const exportDetailsEl = detailsEl;
    detailsEl.createEl("summary", {
      text: t("EXPORT_SUBHEAD"),
      cls: "excalidraw-setting-h3",
    });
    addYouTubeThumbnail(detailsEl, "wTtaXmRJ7wg", 171);

    const pdfExportEl = this.buildSetting(detailsEl, {
      name: t("SHOW_DRAWING_OR_MD_IN_EXPORTPDF_NAME"),
      desc: fragWithHTML(t("SHOW_DRAWING_OR_MD_IN_EXPORTPDF_DESC")),
      control: { type: "toggle", key: "renderImageInMarkdownToPDF" },
    });
    pdfExportEl.nameEl.setAttribute("id", TAG_PDFEXPORT);

    this.buildSetting(detailsEl, {
      name: t("EXPORT_EMBED_SCENE_NAME"),
      desc: fragWithHTML(t("EXPORT_EMBED_SCENE_DESC")),
      control: { type: "toggle", key: "exportEmbedScene" },
    });

    detailsEl = exportDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("EMBED_SIZING"),
      cls: "excalidraw-setting-h4",
    });
    this.buildSetting(detailsEl, {
      name: t("EMBED_WIDTH_NAME"),
      desc: fragWithHTML(t("EMBED_WIDTH_DESC")),
      control: {
        type: "text",
        key: "width",
        placeholder: "400",
        afterUpdate: () => {
          this.requestEmbedUpdate = true;
        },
      },
    });

    this.buildSetting(detailsEl, {
      name: t("EMBED_HEIGHT_NAME"),
      desc: fragWithHTML(t("EMBED_HEIGHT_DESC")),
      control: {
        type: "text",
        key: "height",
        placeholder: "400",
        afterUpdate: () => {
          this.requestEmbedUpdate = true;
        },
      },
    });

    this.buildSetting(detailsEl, {
      name: t("EXPORT_PNG_SCALE_NAME"),
      desc: t("EXPORT_PNG_SCALE_DESC"),
      control: {
        type: "slider",
        key: "pngExportScale",
        min: 1,
        max: 5,
        step: 0.5,
      },
    });

    this.buildSetting(detailsEl, {
      name: t("EXPORT_PADDING_NAME"),
      desc: fragWithHTML(t("EXPORT_PADDING_DESC")),
      control: {
        type: "slider",
        key: "exportPaddingSVG",
        min: 0,
        max: 50,
        step: 5,
      },
    });

    detailsEl = exportDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("EMBED_THEME_BACKGROUND"),
      cls: "excalidraw-setting-h4",
    });

    this.buildSetting(detailsEl, {
      name: t("EXPORT_BACKGROUND_NAME"),
      desc: fragWithHTML(t("EXPORT_BACKGROUND_DESC")),
      control: {
        type: "toggle",
        key: "exportWithBackground",
        afterUpdate: () => {
          this.requestEmbedUpdate = true;
        },
      },
    });

    this.buildSetting(detailsEl, {
      name: t("EXPORT_THEME_NAME"),
      desc: fragWithHTML(t("EXPORT_THEME_DESC")),
      control: {
        type: "toggle",
        key: "exportWithTheme",
        afterUpdate: () => {
          this.requestEmbedUpdate = true;
        },
      },
    });

    this.buildSetting(detailsEl, {
      name: t("PREVIEW_MATCH_OBSIDIAN_NAME"),
      desc: fragWithHTML(t("PREVIEW_MATCH_OBSIDIAN_DESC")),
      control: { type: "toggle", key: "previewMatchObsidianTheme" },
    });

    detailsEl = exportDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("PDF_EXPORT_SETTINGS"),
      cls: "excalidraw-setting-h4",
    });

    new PDFExportSettingsComponent(
      detailsEl,
      this.plugin.settings.pdfSettings,
      () => {
        this.applySettingsUpdate();
      },
    ).render();

    detailsEl = exportDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("EXPORT_HEAD"),
      cls: "excalidraw-setting-h4",
    });
    detailsEl.setAttribute("id", TAG_AUTOEXPORT);

    this.buildSetting(detailsEl, {
      name: t("EXPORT_SYNC_NAME"),
      desc: fragWithHTML(t("EXPORT_SYNC_DESC")),
      control: { type: "toggle", key: "keepInSync" },
    });

    const removeDropdownOption = (opt: string) => {
      let i = 0;
      for (i = 0; i < dropdown.selectEl.options.length; i++) {
        if (dropdown.selectEl.item(i).label === opt) {
          dropdown.selectEl.item(i).remove();
        }
      }
    };

    new Setting(detailsEl)
      .setName(t("EXPORT_SVG_NAME"))
      .setDesc(fragWithHTML(t("EXPORT_SVG_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoexportSVG)
          .onChange(async (value) => {
            if (value) {
              dropdown.addOption("SVG", "SVG");
            } else {
              if (this.plugin.settings.embedType === "SVG") {
                dropdown.setValue("excalidraw");
                this.plugin.settings.embedType = "excalidraw";
              }
              removeDropdownOption("SVG");
            }
            this.plugin.settings.autoexportSVG = value;
            this.applySettingsUpdate();
          }),
      );

    new Setting(detailsEl)
      .setName(t("EXPORT_PNG_NAME"))
      .setDesc(fragWithHTML(t("EXPORT_PNG_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoexportPNG)
          .onChange(async (value) => {
            if (value) {
              dropdown.addOption("PNG", "PNG");
            } else {
              if (this.plugin.settings.embedType === "PNG") {
                dropdown.setValue("excalidraw");
                this.plugin.settings.embedType = "excalidraw";
              }
              removeDropdownOption("PNG");
            }
            this.plugin.settings.autoexportPNG = value;
            this.applySettingsUpdate();
          }),
      );

    this.buildSetting(detailsEl, {
      name: t("EXPORT_BOTH_DARK_AND_LIGHT_NAME"),
      desc: fragWithHTML(t("EXPORT_BOTH_DARK_AND_LIGHT_DESC")),
      control: { type: "toggle", key: "autoExportLightAndDark" },
    });

  }

  private renderEmbeddingSettingsSection(): void {
    const { containerEl } = this;
    let detailsEl: HTMLElement;
    // ------------------------------------------------
    // Embedding settings
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({
      text: t("EMBED_TOEXCALIDRAW_DESC"),
      cls: "setting-item-description",
    });

    detailsEl = this.containerEl.createEl("details");
    const embedFilesDetailsEl = detailsEl;
    detailsEl.createEl("summary", {
      text: t("EMBED_TOEXCALIDRAW_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    detailsEl = embedFilesDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("PDF_TO_IMAGE"),
      cls: "excalidraw-setting-h3",
    });

    addYouTubeThumbnail(detailsEl, "nB4cOfn0xAs");
    this.buildSetting(detailsEl, {
      name: t("PDF_TO_IMAGE_SCALE_NAME"),
      desc: fragWithHTML(t("PDF_TO_IMAGE_SCALE_DESC")),
      control: {
        type: "number-dropdown",
        key: "pdfScale",
        options: [0.5, 1, 2, 3, 4, 5, 6].map((value) => ({
          value,
          label: value.toString(),
        })),
      },
    });

    detailsEl = embedFilesDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("MD_EMBED_CUSTOMDATA_HEAD_NAME"),
      cls: "excalidraw-setting-h3",
    });

    this.buildSetting(detailsEl, {
      name: t("MD_EMBED_SINGLECLICK_EDIT_NAME"),
      desc: fragWithHTML(t("MD_EMBED_SINGLECLICK_EDIT_DESC")),
      control: { type: "toggle", key: "markdownNodeOneClickEditing" },
    });

    detailsEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    detailsEl.createSpan({}, (el) => {
      setSanitizedHtml(el, t("MD_EMBED_CUSTOMDATA_HEAD_DESC"));
    });

    new EmbeddalbeMDFileCustomDataSettingsComponent(
      detailsEl,
      this.plugin.settings.embeddableMarkdownDefaults,
      (val?: boolean) => this.applySettingsUpdate(val),
    ).render();

    detailsEl = embedFilesDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("MD_HEAD"),
      cls: "excalidraw-setting-h3",
    });

    new Setting(detailsEl)
      .setName(t("MD_TRANSCLUDE_WIDTH_NAME"))
      .setDesc(fragWithHTML(t("MD_TRANSCLUDE_WIDTH_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("Enter a number e.g. 500")
          .setValue(this.plugin.settings.mdSVGwidth.toString())
          .onChange(async (value) => {
            const intVal = parseInt(value);
            if (isNaN(intVal) && value !== "") {
              text.setValue(this.plugin.settings.mdSVGwidth.toString());
              return;
            }
            this.requestEmbedUpdate = true;
            if (value === "") {
              this.plugin.settings.mdSVGwidth = 500;
              this.applySettingsUpdate(true);
              return;
            }
            this.plugin.settings.mdSVGwidth = intVal;
            this.requestReloadDrawings = true;
            text.setValue(this.plugin.settings.mdSVGwidth.toString());
            this.applySettingsUpdate(true);
          }),
      );

    new Setting(detailsEl)
      .setName(t("MD_TRANSCLUDE_HEIGHT_NAME"))
      .setDesc(fragWithHTML(t("MD_TRANSCLUDE_HEIGHT_DESC")))
      .addText((text) =>
        text
          .setPlaceholder("Enter a number e.g. 800")
          .setValue(this.plugin.settings.mdSVGmaxHeight.toString())
          .onChange(async (value) => {
            const intVal = parseInt(value);
            if (isNaN(intVal) && value !== "") {
              text.setValue(this.plugin.settings.mdSVGmaxHeight.toString());
              return;
            }
            this.requestEmbedUpdate = true;
            if (value === "") {
              this.plugin.settings.mdSVGmaxHeight = 800;
              this.applySettingsUpdate(true);
              return;
            }
            this.plugin.settings.mdSVGmaxHeight = intVal;
            this.requestReloadDrawings = true;
            text.setValue(this.plugin.settings.mdSVGmaxHeight.toString());
            this.applySettingsUpdate(true);
          }),
      );

    const markdownFontSetting = new Setting(detailsEl)
      .setName(t("MD_DEFAULT_FONT_NAME"))
      .setDesc(fragWithHTML(t("MD_DEFAULT_FONT_DESC")));
    this.fontPickers.push(
      new FontPickerComponent(
        markdownFontSetting.controlEl,
        this.app,
        () =>
          getSelectableFontOptions(
            this.app,
            this.plugin.settings.fontAssetsPath,
          ),
      )
        .setAriaLabel(t("MD_DEFAULT_FONT_NAME"))
        .setValue(this.plugin.settings.mdFont)
        .onChange((value) => {
          this.requestReloadDrawings = true;
          this.plugin.settings.mdFont = value;
          this.applySettingsUpdate(true);
        }),
    );

    this.buildSetting(detailsEl, {
      name: t("MD_DEFAULT_COLOR_NAME"),
      desc: fragWithHTML(t("MD_DEFAULT_COLOR_DESC")),
      control: {
        type: "text",
        key: "mdFontColor",
        placeholder: t("DEFAULT_COLOR_MD_DESC"),
        before: () => {
          this.requestReloadDrawings = true;
        },
        reload: true,
      },
    });

    this.buildSetting(detailsEl, {
      name: t("MD_DEFAULT_BORDER_COLOR_NAME"),
      desc: fragWithHTML(t("MD_DEFAULT_BORDER_COLOR_DESC")),
      control: {
        type: "text",
        key: "mdBorderColor",
        placeholder: t("DEFAULT_COLOR_MD_DESC"),
        before: () => {
          this.requestReloadDrawings = true;
        },
        reload: true,
      },
    });

    this.buildSetting(detailsEl, {
      name: t("MD_CSS_NAME"),
      desc: fragWithHTML(t("MD_CSS_DESC")),
      control: {
        type: "text",
        key: "mdCSS",
        placeholder: t("MD_CSS_PLACEHOLDER"),
        before: () => {
          this.requestReloadDrawings = true;
        },
        reload: true,
      },
    });

  }

  private renderNonExcalidrawFeaturesSection(): void {
    const { containerEl } = this;
    let detailsEl: HTMLElement;
    // ------------------------------------------------
    // Non-excalidraw.com supported features
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({
      text: t("NONSTANDARD_DESC"),
      cls: "setting-item-description",
    });
    detailsEl = this.containerEl.createEl("details");
    const nonstandardDetailsEl = detailsEl;
    detailsEl.createEl("summary", {
      text: t("NONSTANDARD_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    detailsEl = nonstandardDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("RENDER_TWEAK_HEAD"),
      cls: "excalidraw-setting-h3",
    });

    this.buildSetting(detailsEl, {
      name: t("MAX_IMAGE_ZOOM_IN_NAME"),
      desc: fragWithHTML(t("MAX_IMAGE_ZOOM_IN_DESC")),
      control: {
        type: "slider",
        key: "areaZoomLimit",
        min: 1,
        max: 10,
        step: 0.5,
        afterUpdate: () => this.plugin.excalidrawConfig.updateValues(this.plugin),
      },
    });

    detailsEl = nonstandardDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("CUSTOM_PEN_HEAD"),
      cls: "excalidraw-setting-h3",
    });
    addYouTubeThumbnail(detailsEl, "OjNhjaH2KjI", 69);
    this.buildSetting(detailsEl, {
      name: t("CUSTOM_PEN_NAME"),
      desc: t("CUSTOM_PEN_DESC"),
      control: {
        type: "number-dropdown",
        key: "numberOfCustomPens",
        parse: "int",
        options: Array.from({ length: 11 }, (_, value) => ({
          value,
          label: value.toString(),
        })),
        after: () => {
          this.requestUpdatePinnedPens = true;
        },
      },
    });

  }

  private renderFontsSection(): void {
    const { containerEl } = this;
    let detailsEl: HTMLElement;
    // ------------------------------------------------
    // Fonts supported features
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({
      text: t("FONTS_DESC"),
      cls: "setting-item-description",
    });
    detailsEl = this.containerEl.createEl("details");
    const fontsDetailsEl = detailsEl;
    detailsEl.createEl("summary", {
      text: t("FONTS_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    detailsEl = fontsDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("CUSTOM_FONT_HEAD"),
      cls: "excalidraw-setting-h3",
    });
    addYouTubeThumbnail(detailsEl, "eKFmrSQhFA4");
    this.buildSetting(detailsEl, {
      name: t("ENABLE_FOURTH_FONT_NAME"),
      desc: fragWithHTML(t("ENABLE_FOURTH_FONT_DESC")),
      control: {
        type: "toggle",
        key: "experimentalEnableFourthFont",
        before: () => {
          this.requestReloadDrawings = true;
        },
        afterUpdate: async (value) => {
          if (value) {
            await this.plugin.initializeFonts();
          }
        },
      },
    });

    const fourthFontSetting = new Setting(detailsEl)
      .setName(t("FOURTH_FONT_NAME"))
      .setDesc(fragWithHTML(t("FOURTH_FONT_DESC")));
    this.fontPickers.push(
      new FontPickerComponent(
        fourthFontSetting.controlEl,
        this.app,
        () =>
          getSelectableFontOptions(
            this.app,
            this.plugin.settings.fontAssetsPath,
            ["Virgil"],
          ),
      )
        .setAriaLabel(t("FOURTH_FONT_NAME"))
        .setValue(this.plugin.settings.experimantalFourthFont)
        .onChange((value) => {
          this.requestReloadDrawings = true;
          this.plugin.settings.experimantalFourthFont = value;
          this.applySettingsUpdate(true);
          void this.plugin.initializeFonts();
        }),
    );

    detailsEl = fontsDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("OFFLINE_CJK_NAME"),
      cls: "excalidraw-setting-h3",
    });

    const cjkdescdiv = detailsEl.createDiv({ cls: "setting-item-description" });
    setSanitizedHtml(cjkdescdiv, t("OFFLINE_CJK_DESC"));

    this.buildSetting(detailsEl, {
      name: t("CJK_ASSETS_FOLDER_NAME"),
      desc: fragWithHTML(t("CJK_ASSETS_FOLDER_DESC")),
      control: {
        type: "text",
        key: "fontAssetsPath",
        placeholder: t("CJK_ASSETS_FOLDER_PLACEHOLDER"),
        vaultPath: { kind: "folder", options: { optional: true } },
      },
    });

    this.buildSetting(detailsEl, {
      name: t("LOAD_CHINESE_FONTS_NAME"),
      control: { type: "toggle", key: "loadChineseFonts" },
    });

    this.buildSetting(detailsEl, {
      name: t("LOAD_JAPANESE_FONTS_NAME"),
      control: { type: "toggle", key: "loadJapaneseFonts" },
    });

    this.buildSetting(detailsEl, {
      name: t("LOAD_KOREAN_FONTS_NAME"),
      control: { type: "toggle", key: "loadKoreanFonts" },
    });

  }

  private renderExperimentalFeaturesSection(): void {
    const { containerEl } = this;
    let detailsEl: HTMLElement;
    // ------------------------------------------------
    // Experimental features
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({
      text: t("EXPERIMENTAL_DESC"),
      cls: "setting-item-description",
    });
    detailsEl = containerEl.createEl("details");
    const experimentalDetailsEl = detailsEl;
    detailsEl.createEl("summary", {
      text: t("EXPERIMENTAL_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    addYouTubeThumbnail(detailsEl, "r08wk-58DPk");
    this.buildSetting(detailsEl, {
      name: t("LATEX_DEFAULT_NAME"),
      desc: fragWithHTML(t("LATEX_DEFAULT_DESC")),
      control: { type: "text", key: "latexBoilerplate" },
    });

    this.buildSetting(detailsEl, {
      name: t("LATEX_PREAMBLE_NAME"),
      desc: fragWithHTML(t("LATEX_PREAMBLE_DESC")),
      control: {
        type: "text",
        key: "latexPreambleLocation",
        placeholder: "e.g.: preamble.sty",
        vaultPath: {
          kind: "file",
          options: { optional: true, extensions: ["sty"] },
        },
      },
    });

    this.buildSetting(detailsEl, {
      name: t("FILETYPE_NAME"),
      desc: fragWithHTML(t("FILETYPE_DESC")),
      control: {
        type: "toggle",
        key: "experimentalFileType",
        after: (value) => this.plugin.experimentalFileTypeDisplayToggle(value),
      },
    });

    this.buildSetting(detailsEl, {
      name: t("FILETAG_NAME"),
      desc: fragWithHTML(t("FILETAG_DESC")),
      control: {
        type: "text",
        key: "experimentalFileTag",
        placeholder: t("INSERT_EMOJI"),
      },
    });

    this.buildSetting(detailsEl, {
      name: t("LIVEPREVIEW_NAME"),
      desc: fragWithHTML(t("LIVEPREVIEW_DESC")),
      control: { type: "toggle", key: "experimentalLivePreview" },
    });

    this.buildSetting(detailsEl, {
      name: t("FADE_OUT_EXCALIDRAW_MARKUP_NAME"),
      desc: fragWithHTML(t("FADE_OUT_EXCALIDRAW_MARKUP_DESC")),
      control: {
        type: "toggle",
        key: "fadeOutExcalidrawMarkup",
        after: (value) =>
          this.plugin.editorHandler.updateCMExtensionState(
            EDITOR_FADEOUT,
            value,
          ),
      },
    });

    this.buildSetting(detailsEl, {
      name: t("EXCALIDRAW_PROPERTIES_NAME"),
      desc: fragWithHTML(t("EXCALIDRAW_PROPERTIES_DESC")),
      control: { type: "toggle", key: "loadPropertySuggestions" },
    });

    detailsEl = experimentalDetailsEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("TASKBONE_HEAD"),
      cls: "excalidraw-setting-h3",
    });

    detailsEl.createDiv({
      text: t("TASKBONE_DESC"),
      cls: "setting-item-description",
    });
    let taskboneAPIKeyText: TextComponent;

    addYouTubeThumbnail(detailsEl, "7gu4ETx7zro");
    this.buildSetting(detailsEl, {
      name: t("TASKBONE_ENABLE_NAME"),
      desc: fragWithHTML(t("TASKBONE_ENABLE_DESC")),
      control: {
        type: "toggle",
        key: "taskboneEnabled",
        before: (value) => {
          taskboneAPIKeyText.setDisabled(!value);
        },
        after: async () => {
          if (this.plugin.settings.taskboneAPIkey === "") {
            const apiKey = await this.plugin.taskbone.initialize(false);
            if (apiKey) {
              taskboneAPIKeyText.setValue(apiKey);
            }
          }
        },
      },
    });

    this.buildSetting(detailsEl, {
      name: t("TASKBONE_APIKEY_NAME"),
      desc: fragWithHTML(t("TASKBONE_APIKEY_DESC")),
      control: {
        type: "text",
        key: "taskboneAPIkey",
        capture: (text) => {
          taskboneAPIKeyText = text;
          configurePasswordTextInput(taskboneAPIKeyText);
          taskboneAPIKeyText.setDisabled(
            !this.plugin.settings.taskboneEnabled,
          );
        },
      },
    });

  }

  private renderExcalidrawAutomateSection(): void {
    const { containerEl } = this;
    let detailsEl: HTMLElement;
    // ------------------------------------------------
    // ExcalidrawAutomate
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({ cls: "setting-item-description" }, (el) => {
      setSanitizedHtml(el, t("EA_DESC"));
    });
    detailsEl = containerEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("EA_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    this.buildSetting(detailsEl, {
      name: t("FIELD_SUGGESTER_NAME"),
      desc: fragWithHTML(t("FIELD_SUGGESTER_DESC")),
      control: { type: "toggle", key: "fieldSuggester" },
    });

    this.buildSetting(detailsEl, {
      name: t("ENABLE_ONLOAD_SCRIPTS_NAME"),
      desc: fragWithHTML(t("ENABLE_ONLOAD_SCRIPTS_DESC")),
      control: { type: "toggle", key: "enableOnloadScripts" },
    });

    this.buildSetting(detailsEl, {
      name: t("ENABLE_COMMAND_LINKS_NAME"),
      desc: fragWithHTML(t("ENABLE_COMMAND_LINKS_DESC")),
      control: { type: "toggle", key: "enableCommandLinks" },
    });

    //STARTUP_SCRIPT_NAME
    //STARTUP_SCRIPT_BUTTON
    let startupScriptPathText: TextComponent;
    let startupScriptButton: ButtonComponent;
    const scriptExists = () => {
      const startupPath = normalizePath(
        this.plugin.settings.startupScriptPath.endsWith(".md")
          ? this.plugin.settings.startupScriptPath
          : `${this.plugin.settings.startupScriptPath}.md`,
      );
      return Boolean(this.app.vault.getAbstractFileByPath(startupPath));
    };
    const startupScriptSetting = new Setting(detailsEl)
      .setName(t("STARTUP_SCRIPT_NAME"))
      .setDesc(fragWithHTML(t("STARTUP_SCRIPT_DESC")));
    startupScriptSetting
      .addText((text) => {
        startupScriptPathText = text;
        text
          .setValue(this.plugin.settings.startupScriptPath)
          .onChange((value) => {
            this.plugin.settings.startupScriptPath = value;
            startupScriptButton.setButtonText(
              scriptExists()
                ? t("STARTUP_SCRIPT_BUTTON_OPEN")
                : t("STARTUP_SCRIPT_BUTTON_CREATE"),
            );
            this.applySettingsUpdate();
          });
        this.addVaultPathSupport(startupScriptSetting, text, "file", {
          optional: true,
          extensions: ["md"],
          resolvePath: (value) =>
            value && !value.endsWith(".md") ? `${value}.md` : value,
        });
      })
      .addButton((button) => {
        startupScriptButton = button;
        startupScriptButton
          .setButtonText(
            scriptExists()
              ? t("STARTUP_SCRIPT_BUTTON_OPEN")
              : t("STARTUP_SCRIPT_BUTTON_CREATE"),
          )
          .onClick(async () => {
            if (this.plugin.settings.startupScriptPath === "") {
              this.plugin.settings.startupScriptPath = normalizePath(
                `${normalizePath(
                  this.plugin.settings.folder,
                )}/ExcalidrawStartup`,
              );
              startupScriptPathText.setValue(
                this.plugin.settings.startupScriptPath,
              );
              this.applySettingsUpdate();
            }
            const startupPath = normalizePath(
              this.plugin.settings.startupScriptPath.endsWith(".md")
                ? this.plugin.settings.startupScriptPath
                : `${this.plugin.settings.startupScriptPath}.md`,
            );
            let f = this.app.vault.getAbstractFileByPath(startupPath);
            if (!f) {
              f = await createOrOverwriteFile(
                this.app,
                startupPath,
                startupScript(),
              );
            }
            startupScriptButton.setButtonText(t("STARTUP_SCRIPT_BUTTON_OPEN"));
            await this.app.workspace.openLinkText(f.path, "", true);
            this.hide();
          });
      });

    //-------------------------------------
    //Autostart scripts
    //-------------------------------------
    new AutostartScriptsSettingsComponent(
      detailsEl.createDiv(),
      this.plugin,
    ).render();
  }

  private renderCompatibilitySection(): void {
    const { containerEl } = this;
    let detailsEl: HTMLElement;
    // ------------------------------------------------
    // Compatibility
    // ------------------------------------------------
    containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
    containerEl.createDiv({
      text: t("COMPATIBILITY_DESC"),
      cls: "setting-item-description",
    });
    detailsEl = this.containerEl.createEl("details");
    detailsEl.createEl("summary", {
      text: t("COMPATIBILITY_HEAD"),
      cls: "excalidraw-setting-h1",
    });

    this.buildSetting(detailsEl, {
      name: t("DUMMY_TEXT_ELEMENT_LINT_SUPPORT_NAME"),
      desc: fragWithHTML(t("DUMMY_TEXT_ELEMENT_LINT_SUPPORT_DESC")),
      control: { type: "toggle", key: "addDummyTextElement" },
    });

    this.buildSetting(detailsEl, {
      name: t("PRESERVE_TEXT_AFTER_DRAWING_NAME"),
      desc: fragWithHTML(t("PRESERVE_TEXT_AFTER_DRAWING_DESC")),
      control: { type: "toggle", key: "zoteroCompatibility" },
    });

    this.buildSetting(detailsEl, {
      name: t("SLIDING_PANES_NAME"),
      desc: fragWithHTML(t("SLIDING_PANES_DESC")),
      control: { type: "toggle", key: "slidingPanesSupport" },
    });

    this.buildSetting(detailsEl, {
      name: t("COMPATIBILITY_MODE_NAME"),
      desc: fragWithHTML(t("COMPATIBILITY_MODE_DESC")),
      control: {
        type: "toggle",
        key: "compatibilityMode",
        after: () => this.refreshFilenameSample(),
      },
    });

    this.buildSetting(detailsEl, {
      name: t("EXPORT_EXCALIDRAW_NAME"),
      desc: fragWithHTML(t("EXPORT_EXCALIDRAW_DESC")),
      control: { type: "toggle", key: "autoexportExcalidraw" },
    });

    this.buildSetting(detailsEl, {
      name: t("SYNC_EXCALIDRAW_NAME"),
      desc: fragWithHTML(t("SYNC_EXCALIDRAW_DESC")),
      control: { type: "toggle", key: "syncExcalidraw" },
    });

    //-------------------------------------
    //Script settings
    //-------------------------------------
    const scripts = this.plugin.scriptEngine
      .getListofScripts()
      ?.map((f) => this.plugin.scriptEngine.getScriptName(f));
    if (
      Object.keys(this.plugin.settings.scriptEngineSettings).length > 0 &&
      scripts
    ) {
      const textAreaHeight = (
        scriptName: string,
        variableName: string,
      ): number | undefined | null => {
        const variable =
          this.plugin.settings.scriptEngineSettings[scriptName][variableName];
        switch (typeof variable) {
          case "object":
            return variable.height;
          default:
            return null;
        }
      };

      const getValue = (
        scriptName: string,
        variableName: string,
      ): string | number | boolean | undefined => {
        const variable =
          this.plugin.settings.scriptEngineSettings[scriptName][variableName];
        switch (typeof variable) {
          case "object":
            return variable.value;
          default:
            return variable;
        }
      };

      const setValue = (
        scriptName: string,
        variableName: string,
        value: string | number | boolean | undefined,
      ) => {
        switch (
          typeof this.plugin.settings.scriptEngineSettings[scriptName][
            variableName
          ]
        ) {
          case "object":
            this.plugin.settings.scriptEngineSettings[scriptName][
              variableName
            ].value = value;
            break;
          default:
            this.plugin.settings.scriptEngineSettings[scriptName][
              variableName
            ] = value;
        }
      };

      const addBooleanSetting = (
        scriptName: string,
        variableName: string,
        description?: string,
      ) => {
        new Setting(detailsEl)
          .setName(variableName)
          .setDesc(fragWithHTML(description ?? ""))
          .addToggle((toggle) =>
            toggle
              .setValue(getValue(scriptName, variableName) as boolean)
              .onChange(async (value) => {
                setValue(scriptName, variableName, value);
                this.applySettingsUpdate();
              }),
          );
      };

      const addStringSetting = (
        scriptName: string,
        variableName: string,
        description?: string,
        valueset?: string[],
      ) => {
        if (
          valueset &&
          Object.prototype.toString.call(valueset) === "[object Array]" &&
          valueset.length > 0
        ) {
          new Setting(detailsEl)
            .setName(variableName)
            .setDesc(fragWithHTML(description ?? ""))
            .addDropdown((dropdown) => {
              valueset.forEach((val: string) => {
                void dropdown.addOption(val.toString(), val.toString());
              });
              dropdown
                .setValue(getValue(scriptName, variableName) as string)
                .onChange(async (value) => {
                  setValue(scriptName, variableName, value);
                  this.applySettingsUpdate();
                });
            });
        } else if (textAreaHeight(scriptName, variableName)) {
          new Setting(detailsEl)
            .setName(variableName)
            .setDesc(fragWithHTML(description ?? ""))
            .addTextArea((text) => {
              setStyle(text.inputEl, {
                minHeight: textAreaHeight(scriptName, variableName)
                  ? `${textAreaHeight(scriptName, variableName)}px`
                  : "",
                minWidth: "400px",
                width: "100%",
              });
              text
                .setValue(getValue(scriptName, variableName) as string)
                .onChange(async (value) => {
                  setValue(scriptName, variableName, value);
                  this.applySettingsUpdate();
                });
            });
        } else {
          new Setting(detailsEl)
            .setName(variableName)
            .setDesc(fragWithHTML(description ?? ""))
            .addText((text) =>
              text
                .setValue(getValue(scriptName, variableName) as string)
                .onChange(async (value) => {
                  setValue(scriptName, variableName, value);
                  this.applySettingsUpdate();
                }),
            );
        }
      };

      const addNumberSetting = (
        scriptName: string,
        variableName: string,
        description?: string,
      ) => {
        new Setting(detailsEl)
          .setName(variableName)
          .setDesc(fragWithHTML(description ?? ""))
          .addText((text) =>
            text
              .setPlaceholder("Enter a number")
              .setValue(getValue(scriptName, variableName).toString())
              .onChange(async (value) => {
                const numVal = parseFloat(value);
                if (isNaN(numVal) && value !== "") {
                  text.setValue(getValue(scriptName, variableName).toString());
                  return;
                }
                setValue(scriptName, variableName, isNaN(numVal) ? 0 : numVal);
                this.applySettingsUpdate();
              }),
          );
      };

      containerEl.createEl("hr", { cls: "excalidraw-setting-hr" });
      containerEl.createDiv({
        text: t("SCRIPT_SETTINGS_DESC"),
        cls: "setting-item-description",
      });
      detailsEl = this.containerEl.createEl("details");
      const scriptDetailsEl = detailsEl;
      detailsEl.createEl("summary", {
        text: t("SCRIPT_SETTINGS_HEAD"),
        cls: "excalidraw-setting-h1",
      });

      addYouTubeThumbnail(detailsEl, "H8Njp7ZXYag", 52);
      Object.keys(this.plugin.settings.scriptEngineSettings)
        .filter((s) => scripts.contains(s))
        .forEach((scriptName: string) => {
          const settings =
            this.plugin.settings.scriptEngineSettings[scriptName];
          const values = Object.values(settings);
          if (
            values.length === 0 ||
            (values.length > 0 &&
              values
                .map((val: ScriptSettingValue): number => (val.hidden ? 0 : 1))
                .reduce((prev, cur) => prev + cur) === 0)
          ) {
            return;
          }
          detailsEl = scriptDetailsEl.createEl("details");
          detailsEl.createEl("summary", {
            text: scriptName,
            cls: "excalidraw-setting-h3",
          });

          Object.keys(settings).forEach((variableName) => {
            const variable = settings[variableName];
            const scriptSetting =
              typeof variable === "object" && variable !== null
                ? variable
                : null;
            const item = scriptSetting?.value ?? variable;
            switch (typeof item) {
              case "boolean":
                if (!scriptSetting?.hidden) {
                  addBooleanSetting(
                    scriptName,
                    variableName,
                    scriptSetting?.description,
                  );
                }
                break;
              case "string":
                if (!scriptSetting?.hidden) {
                  addStringSetting(
                    scriptName,
                    variableName,
                    scriptSetting?.description,
                    scriptSetting?.valueset,
                  );
                }
                break;
              case "number":
                if (!scriptSetting?.hidden) {
                  addNumberSetting(
                    scriptName,
                    variableName,
                    scriptSetting?.description,
                  );
                }
                break;
            }
          });
        });
    }
  }

}
