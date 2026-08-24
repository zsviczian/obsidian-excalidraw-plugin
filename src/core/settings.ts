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
  DEVICE,
  getCSSFontDefinition,
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
import {
  addYouTubeThumbnail,
  fragWithHTML,
  setLeftHandedMode,
  setUIMode,
} from "src/utils/utils";
import { setElementHidden, setSanitizedHtml } from "src/utils/htmlUtils";
import { getImageCache } from "src/shared/ImageCache";
import { MultiOptionConfirmationPrompt } from "src/shared/Dialogs/Prompt";
import { EmbeddalbeMDFileCustomDataSettingsComponent } from "src/shared/Dialogs/EmbeddableMDFileCustomDataSettingsComponent";
import { AutostartScriptsSettingsComponent } from "src/shared/Dialogs/AutostartScriptsSettingsComponent";
import { startupScript } from "src/constants/starutpscript";
import {
  getModifierKeyCategoryName,
  MODIFIER_KEY_CATEGORIES,
  ModifierKeySettingsComponent,
} from "src/shared/Dialogs/ModifierKeySettings";
import {
  modifierKeyTooltipMessages,
  type ModifierSetType,
} from "src/utils/modifierkeyHelper";
import { EDITOR_FADEOUT } from "src/core/editor/EditorHandler";
import {
  TAG_AUTOEXPORT,
  TAG_MDREADINGMODE,
  TAG_PDFEXPORT,
} from "src/constants/constSettingsTags";
import { HotkeyEditor } from "src/shared/Dialogs/HotkeyEditor";
import { getExcalidrawViews } from "src/utils/obsidianUtils";
import { configureSliderWithText } from "src/utils/sliderUtils";
import { PDFExportSettingsComponent } from "src/shared/Dialogs/PDFExportSettingsComponent";
import { ContentSearcher } from "src/shared/components/ContentSearcher";
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
import {
  getMarkdownFontFamilyId,
  getSelectableFontOptions,
} from "src/utils/fontUtils";
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
import {
  canNavigateSettingsPages,
  navigateToSettingsPage,
} from "src/core/settings/settingsNavigation";

declare const mainDocument: Document;

/** Strips characters that are invalid in filenames on common filesystems. */
const sanitizeFilenameSegment = (value: string): string =>
  value.replaceAll(/[<>:"/\\|?*]/g, "_");

const NAVIGATION_TAG_EMBED_PREVIEW = "EmbedPreview";

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
  legacyId?: string;
  navigationTags?: readonly string[];
  visible?: boolean | (() => boolean);
  children?: SettingsPageModel[];
  buildDefinitions?: () => SettingDefinitionItem<SettingBindingKey>[];
  renderLegacy?: (container: HTMLElement) => void;
}

/** Mutable component references scoped to one rendered settings tree. */
interface SettingsRenderState {
  filenameSampleEl: HTMLElement | null;
  gridColorSettingEl: HTMLElement | null;
  todoPrefixSetting: TextComponent | null;
  donePrefixSetting: TextComponent | null;
  embedTypeDropdown: DropdownComponent | null;
  embedCommentSettingEl: HTMLElement | null;
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
  private declarativePagePathsByTag: ReadonlyMap<
    string,
    readonly string[]
  > | null = null;
  private persistenceOwnerWindow: Window | null = null;
  private readonly flushOnSettingsWindowBlur = (): void => {
    void this.settingsPersistenceQueue.flush().catch((): void => undefined);
  };
  private hotkeyEditor: HotkeyEditor | null = null;
  private fontPickers: FontPickerComponent[] = [];
  private legacyCrossLinkCleanup: (() => void) | null = null;
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

  private trackFontPicker(picker: FontPickerComponent): () => void {
    this.fontPickers.push(picker);
    return () => {
      const index = this.fontPickers.indexOf(picker);
      if (index !== -1) {
        this.fontPickers.splice(index, 1);
      }
      picker.destroy();
    };
  }

  private async getBuiltInMarkdownFontCss(
    fontFamily: string,
  ): Promise<string | null> {
    const fontId = getMarkdownFontFamilyId(fontFamily);
    if (fontId === null || typeof getCSSFontDefinition !== "function") {
      return null;
    }
    return await getCSSFontDefinition(fontId);
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

  /** Refreshes a mounted settings tab after a script changes its declarations. */
  refreshAfterExternalSettingsChange(): void {
    if (!this.containerEl.isConnected) {
      return;
    }
    this.refreshSettingsUI();
  }

  private refreshDeclarativeDomState(): void {
    if (!this.declarativeDefinitionsActive) {
      return;
    }
    getDeclarativeSettingTabRuntime(this)?.refreshDomState();
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

  private createRenderedDefinition(options: {
    name: string;
    desc?: string | DocumentFragment;
    aliases?: string[];
    searchable?: boolean | (() => boolean);
    visible?: boolean | (() => boolean);
    controlType?: string;
    omitFromMarkdown?: boolean;
    render: (container: HTMLElement) => void | (() => void);
  }): SettingDefinition<SettingBindingKey> {
    return annotateMarkdownDefinition(
      {
        name: options.name,
        desc: options.desc,
        aliases: options.aliases,
        searchable: options.searchable,
        visible: options.visible,
        render: (setting) => {
          this.prepareFullWidthDeclarativeSetting(setting);
          return options.render(setting.settingEl);
        },
      },
      {
        controlType: options.controlType,
        omit: options.omitFromMarkdown,
      },
    );
  }

  private createCustomSettingDefinition(options: {
    name: string;
    desc?: string | DocumentFragment;
    aliases?: string[];
    visible?: boolean | (() => boolean);
    controlType: string;
    configure: (setting: Setting) => void | (() => void);
  }): SettingDefinition<SettingBindingKey> {
    return annotateMarkdownDefinition(
      {
        name: options.name,
        desc: options.desc,
        aliases: options.aliases,
        visible: options.visible,
        render: (setting) => options.configure(setting),
      },
      { controlType: options.controlType },
    );
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
    pagePath?: readonly string[],
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
          if (pagePath) {
            this.renderDeclarativeBreadcrumbs(setting.settingEl, pagePath);
          }
          if (includeMastery) {
            this.renderMasteryPromo(setting.settingEl);
          }
          return this.attachDeclarativeSettingsCrossLinks(
            setting.settingEl.parentElement,
          );
        },
      },
      { omit: true },
    );
  }

  private getDeclarativePagePathByTag(tag: string): readonly string[] | null {
    if (this.declarativePagePathsByTag) {
      return this.declarativePagePathsByTag.get(tag) ?? null;
    }

    const pathsByTag = new Map<string, readonly string[]>();
    const visit = (
      pages: readonly SettingsPageModel[],
      parentPath: readonly string[],
    ): void => {
      for (const page of pages) {
        const pagePath = [...parentPath, page.name];
        if (page.legacyId) {
          pathsByTag.set(page.legacyId, pagePath);
        }
        for (const navigationTag of page.navigationTags ?? []) {
          pathsByTag.set(navigationTag, pagePath);
        }
        visit(page.children ?? [], pagePath);
      }
    };

    visit(this.getSettingsPages(), []);
    this.declarativePagePathsByTag = pathsByTag;
    return pathsByTag.get(tag) ?? null;
  }

  private attachDeclarativeSettingsCrossLinks(
    container: HTMLElement | null,
  ): () => void {
    if (!container) {
      return () => undefined;
    }
    container.addClass("excalidraw-settings-page");
    const handleClick = (event: MouseEvent): void => {
      const HTMLElementCtor = container.ownerDocument.defaultView?.HTMLElement;
      if (
        !HTMLElementCtor ||
        !(event.target instanceof HTMLElementCtor) ||
        !canNavigateSettingsPages(this.app)
      ) {
        return;
      }
      const anchor = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
      const href = anchor?.getAttribute("href");
      if (!anchor || !href || !container.contains(anchor)) {
        return;
      }
      const pagePath = this.getDeclarativePagePathByTag(
        decodeURIComponent(href.slice(1)),
      );
      if (!pagePath) {
        return;
      }
      event.preventDefault();
      navigateToSettingsPage(this.app, this.plugin.manifest.id, pagePath);
    };
    container.addEventListener("click", handleClick);
    return () => {
      container.removeEventListener("click", handleClick);
      container.removeClass("excalidraw-settings-page");
    };
  }

  private attachLegacySettingsCrossLinks(): void {
    this.detachLegacySettingsCrossLinks();
    const { containerEl } = this;
    const cleanup: (() => void)[] = [];
    containerEl
      .querySelectorAll<HTMLAnchorElement>('a[href^="#"]')
      .forEach((anchor) => {
        const href = anchor.getAttribute("href");
        if (!href) {
          return;
        }
        const targetId = decodeURIComponent(href.slice(1));
        const target = Array.from(
          containerEl.querySelectorAll<HTMLElement>("[id]"),
        ).find((element) => element.id === targetId);
        if (!target) {
          return;
        }
        const handleClick = (event: MouseEvent): void => {
          event.preventDefault();
          event.stopPropagation();
          let details = target.closest<HTMLDetailsElement>("details");
          while (details && containerEl.contains(details)) {
            details.open = true;
            details =
              details.parentElement?.closest<HTMLDetailsElement>("details") ??
              null;
          }
          containerEl.ownerDocument.defaultView?.requestAnimationFrame(() => {
            if (target.isConnected) {
              target.scrollIntoView({ block: "center" });
            }
          });
        };
        anchor.addEventListener("click", handleClick, true);
        cleanup.push(() =>
          anchor.removeEventListener("click", handleClick, true),
        );
      });
    this.legacyCrossLinkCleanup = () => cleanup.forEach((remove) => remove());
  }

  private detachLegacySettingsCrossLinks(): void {
    this.legacyCrossLinkCleanup?.();
    this.legacyCrossLinkCleanup = null;
  }

  private renderDeclarativeBreadcrumbs(
    container: HTMLElement,
    pagePath: readonly string[],
  ): void {
    const breadcrumbs = container.createDiv({
      cls: "excalidraw-settings-breadcrumbs",
      attr: { "aria-label": t("SETTINGS_BREADCRUMB_ARIA") },
    });
    const segments = [this.plugin.manifest.name, ...pagePath];
    const canNavigate = canNavigateSettingsPages(this.app);

    segments.forEach((segment, index) => {
      if (index > 0) {
        breadcrumbs.createSpan({
          text: "›",
          cls: "excalidraw-settings-breadcrumbs__separator",
          attr: { "aria-hidden": "true" },
        });
      }

      const isCurrentPage = index === segments.length - 1;
      if (isCurrentPage || !canNavigate) {
        breadcrumbs.createSpan({
          text: segment,
          cls: isCurrentPage
            ? "excalidraw-settings-breadcrumbs__current"
            : undefined,
          attr: isCurrentPage ? { "aria-current": "page" } : undefined,
        });
        return;
      }

      const targetPath = pagePath.slice(0, index);
      const link = breadcrumbs.createEl("a", {
        text: segment,
        href: "#",
        cls: "excalidraw-settings-breadcrumbs__link",
      });
      link.onClickEvent((event) => {
        event.preventDefault();
        event.stopPropagation();
        if (
          !navigateToSettingsPage(
            this.app,
            this.plugin.manifest.id,
            targetPath,
          )
        ) {
          link.removeAttribute("href");
          link.setAttribute("aria-disabled", "true");
          link.addClass("is-disabled");
        }
      });
    });
  }

  private createRelatedSettingsPageDefinition(options: {
    key: string;
    name: string;
    description: string;
    targetTag: string;
  }): SettingDefinition<SettingBindingKey> {
    return annotateMarkdownDefinition(
      {
        name: `${options.key} · related settings navigation`,
        searchable: false,
        visible: () =>
          canNavigateSettingsPages(this.app) &&
          this.getDeclarativePagePathByTag(options.targetTag) !== null,
        render: (setting) => {
          setting
            .setName(options.name)
            .setDesc(options.description)
            .addButton((button) =>
              button
                .setButtonText(t("SETTINGS_NAVIGATION_OPEN"))
                .onClick(() => {
                  const targetPath = this.getDeclarativePagePathByTag(
                    options.targetTag,
                  );
                  if (
                    !targetPath ||
                    !navigateToSettingsPage(
                      this.app,
                      this.plugin.manifest.id,
                      targetPath,
                    )
                  ) {
                    button.setDisabled(true);
                  }
                }),
            );
        },
      },
      { omit: true },
    );
  }

  private createDeclarativePageItems(
    pagePath: readonly string[],
    description: string,
    items: SettingDefinitionItem<SettingBindingKey>[],
  ): SettingDefinitionItem<SettingBindingKey>[] {
    const scope = pagePath.at(-1) ?? this.plugin.manifest.name;
    return [
      this.createDeclarativeUtilitiesDefinition(scope, false, pagePath),
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

  private createFilenameInformationDefinition(
    renderState: SettingsRenderState,
  ): SettingDefinition<SettingBindingKey> {
    return annotateMarkdownDefinition(
      {
        name: t("FILENAME_HEAD"),
        desc: t("FILENAME_DESC"),
        aliases: ["filename preview", "file naming", "drawing name"],
        render: (setting) => {
          this.prepareFullWidthDeclarativeSetting(setting);
          this.renderFilenameInformation(setting.settingEl, renderState);
        },
      },
      { omit: true },
    );
  }

  private createYouTubeDefinition(
    scope: string,
    videoId: string,
    startAt?: number,
  ): SettingDefinition<SettingBindingKey> {
    return this.createRenderedDefinition({
      name: `${scope} · YouTube · ${videoId}`,
      searchable: false,
      omitFromMarkdown: true,
      render: (container) => addYouTubeThumbnail(container, videoId, startAt),
    });
  }

  private getBasicAndSavingPages(
    renderState: SettingsRenderState,
  ): SettingsPageModel[] {
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
            this.createYouTubeDefinition(
              t("TEMPLATE_NAME"),
              "jgUpYznHP9A",
              216,
            ),
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
            this.createFilenameInformationDefinition(renderState),
            ...this.toDeclarativeDefinitions(
              this.getFilenameSpecs(renderState),
            ),
          ],
          renderLegacy: (container) => {
            this.renderFilenameInformation(container, renderState);
            this.renderSettingSpecs(
              container,
              this.getFilenameSpecs(renderState),
            );
          },
        },
      ],
    };

    return [basicPage, savingPage];
  }

  private getDisplayAndLinksPages(
    renderState: SettingsRenderState,
  ): SettingsPageModel[] {
    const modifierKeyPage: SettingsPageModel = {
      name: t("DRAG_MODIFIER_NAME"),
      description: t("DRAG_MODIFIER_GROUP_DESC"),
      buildDefinitions: () => [this.createModifierKeyUsageDefinition()],
      renderLegacy: (container) => this.renderModifierKeyUsage(container),
      children: [
        {
          name: t("LINK_OPENING_GESTURES_HEAD"),
          description: t("LINK_OPENING_GESTURES_DESC"),
          buildDefinitions: () =>
            this.toDeclarativeDefinitions(this.getLinkOpeningGestureSpecs()),
          renderLegacy: (container) =>
            this.renderSettingSpecs(
              container,
              this.getLinkOpeningGestureSpecs(),
            ),
        },
        ...MODIFIER_KEY_CATEGORIES.map(
          (modifierSetType): SettingsPageModel => ({
            name: getModifierKeyCategoryName(modifierSetType),
            description:
              this.getModifierKeyCategoryDescription(modifierSetType),
            buildDefinitions: () => [
              this.createModifierKeyCategoryDefinition(modifierSetType),
            ],
            renderLegacy: (container) =>
              this.renderModifierKeyCategory(container, modifierSetType),
          }),
        ),
      ],
    };

    const displayPage: SettingsPageModel = {
      name: t("DISPLAY_HEAD"),
      description: t("DISPLAY_DESC"),
      children: [
        {
          name: t("DISPLAY_EDITOR_PREVIEWS_HEAD"),
          description: t("DISPLAY_EDITOR_PREVIEWS_DESC"),
          navigationTags: [TAG_MDREADINGMODE],
          buildDefinitions: () =>
            this.toDeclarativeDefinitions(this.getDisplayEditorPreviewSpecs()),
          renderLegacy: (container) =>
            this.renderDisplayEditorPreviewSettings(container),
        },
        {
          name: t("MODES_HEAD"),
          description: t("MODES_DESC"),
          buildDefinitions: () => [
            ...this.toDeclarativeDefinitions(this.getUIModeSpecs()),
            this.createYouTubeDefinition(t("MODES_HEAD"), "H8Njp7ZXYag", 999),
          ],
          renderLegacy: (container) => {
            this.renderSettingSpecs(container, this.getUIModeSpecs());
            addYouTubeThumbnail(container, "H8Njp7ZXYag", 999);
          },
        },
        {
          name: t("HOTKEY_OVERRIDE_HEAD"),
          description: t("HOTKEY_OVERRIDE_GROUP_DESC"),
          buildDefinitions: () => [this.createHotkeyEditorDefinition()],
          renderLegacy: (container) => this.renderHotkeyEditor(container),
        },
        {
          name: t("THEME_HEAD"),
          description: t("THEME_DESC"),
          buildDefinitions: () => {
            const specs = this.getThemeSpecs();
            return [
              ...this.toDeclarativeDefinitions(specs.slice(0, 2)),
              this.createYouTubeDefinition(
                t("DYNAMICSTYLE_NAME"),
                "fypDth_-8q0",
              ),
              ...this.toDeclarativeDefinitions(specs.slice(2, 3)),
              this.createYouTubeDefinition(
                t("IFRAME_MATCH_THEME_NAME"),
                "ICpoyMv6KSs",
              ),
              ...this.toDeclarativeDefinitions(specs.slice(3)),
            ];
          },
          renderLegacy: (container) => this.renderThemeSettings(container),
        },
        {
          name: t("ZOOM_AND_PAN_HEAD"),
          description: t("ZOOM_AND_PAN_DESC"),
          buildDefinitions: () => {
            const specs = this.getZoomAndPanSpecs();
            return [
              ...this.toDeclarativeDefinitions(specs.slice(0, 2)),
              this.createYouTubeDefinition(
                t("DEFAULT_PINCHZOOM_NAME"),
                "rBarRfcSxNo",
                107,
              ),
              ...this.toDeclarativeDefinitions(specs.slice(2)),
            ];
          },
          renderLegacy: (container) => this.renderZoomAndPanSettings(container),
        },
        {
          name: t("PEN_HEAD"),
          description: t("PEN_DESC"),
          buildDefinitions: () =>
            this.toDeclarativeDefinitions(this.getPenSpecs()),
          renderLegacy: (container) =>
            this.renderSettingSpecs(container, this.getPenSpecs()),
        },
        {
          name: t("GRID_HEAD"),
          description: t("GRID_DESC"),
          buildDefinitions: () => this.getGridDefinitions(renderState),
          renderLegacy: (container) =>
            this.renderGridSettings(container, renderState),
        },
        {
          name: t("LASER_HEAD"),
          description: t("LASER_DESC"),
          buildDefinitions: () => this.getLaserDefinitions(),
          renderLegacy: (container) => this.renderLaserSettings(container),
        },
        modifierKeyPage,
      ],
    };

    const linksPage: SettingsPageModel = {
      name: t("LINKS_HEAD"),
      description: t("LINKS_HEAD_DESC"),
      children: [
        {
          name: t("LINK_BEHAVIOR_HEAD"),
          description: t("LINK_BEHAVIOR_DESC"),
          buildDefinitions: () => [
            this.createLinkUsageDefinition(),
            ...this.toDeclarativeDefinitions(this.getLinkBehaviorSpecs()),
          ],
          renderLegacy: (container) =>
            this.renderLinkBehaviorSettings(container),
        },
        {
          name: t("LINK_OPENING_HEAD"),
          description: t("LINK_OPENING_DESC"),
          buildDefinitions: () =>
            this.toDeclarativeDefinitions(this.getLinkOpeningSpecs()),
          renderLegacy: (container) =>
            this.renderSettingSpecs(container, this.getLinkOpeningSpecs()),
        },
        {
          name: t("LINK_APPEARANCE_HEAD"),
          description: t("LINK_APPEARANCE_DESC"),
          buildDefinitions: () =>
            this.toDeclarativeDefinitions(this.getLinkAppearanceSpecs()),
          renderLegacy: (container) =>
            this.renderSettingSpecs(container, this.getLinkAppearanceSpecs()),
        },
        {
          name: t("TODO_HEAD"),
          description: t("TODO_GROUP_DESC"),
          buildDefinitions: () =>
            this.toDeclarativeDefinitions(this.getTodoSpecs(renderState)),
          renderLegacy: (container) =>
            this.renderSettingSpecs(container, this.getTodoSpecs(renderState)),
        },
        {
          name: t("TRANSCLUSION_HEAD"),
          description: t("TRANSCLUSION_DESC"),
          buildDefinitions: () => this.getTransclusionDefinitions(),
          renderLegacy: (container) =>
            this.renderTransclusionSettings(container),
        },
      ],
    };

    return [displayPage, linksPage];
  }

  private getEmbedAndExportPages(
    renderState: SettingsRenderState,
  ): SettingsPageModel[] {
    const exportPage: SettingsPageModel = {
      name: t("EXPORT_SUBHEAD"),
      description: t("EXPORT_SUBHEAD_DESC"),
      navigationTags: [TAG_PDFEXPORT],
      buildDefinitions: () => [
        this.createYouTubeDefinition(t("EXPORT_SUBHEAD"), "wTtaXmRJ7wg", 171),
        ...this.toDeclarativeDefinitions(this.getExportGeneralSpecs()),
      ],
      renderLegacy: (container) => this.renderExportGeneralSettings(container),
      children: [
        {
          name: t("EMBED_SIZING"),
          description: t("EMBED_SIZING_DESC"),
          buildDefinitions: () =>
            this.toDeclarativeDefinitions(this.getExportSizingSpecs()),
          renderLegacy: (container) =>
            this.renderSettingSpecs(container, this.getExportSizingSpecs()),
        },
        {
          name: t("EMBED_THEME_BACKGROUND"),
          description: t("EMBED_THEME_BACKGROUND_DESC"),
          buildDefinitions: () =>
            this.toDeclarativeDefinitions(this.getExportThemeSpecs()),
          renderLegacy: (container) =>
            this.renderSettingSpecs(container, this.getExportThemeSpecs()),
        },
        {
          name: t("PDF_EXPORT_SETTINGS"),
          description: t("PDF_EXPORT_SETTINGS_DESC"),
          buildDefinitions: () => [this.createPdfExportSettingsDefinition()],
          renderLegacy: (container) =>
            this.renderPdfExportSettings(container),
        },
        {
          name: t("EXPORT_HEAD"),
          description: t("EXPORT_AUTOEXPORT_DESC"),
          legacyId: TAG_AUTOEXPORT,
          buildDefinitions: () =>
            this.getAutoExportDefinitions(renderState),
          renderLegacy: (container) =>
            this.renderAutoExportSettings(container, renderState),
        },
      ],
    };

    const embedExportPage: SettingsPageModel = {
      name: t("EMBED_HEAD"),
      description: t("EMBED_DESC"),
      children: [
        {
          name: t("EMBED_PREVIEW_LINKS_HEAD"),
          description: t("EMBED_PREVIEW_LINKS_DESC"),
          navigationTags: [NAVIGATION_TAG_EMBED_PREVIEW],
          buildDefinitions: () =>
            this.getEmbedPreviewDefinitions(renderState),
          renderLegacy: (container) =>
            this.renderEmbedPreviewSettings(container, renderState),
        },
        {
          name: t("EMBED_CACHING"),
          description: t("EMBED_CACHING_DESC"),
          buildDefinitions: () => this.getEmbedCacheDefinitions(),
          renderLegacy: (container) => this.renderEmbedCacheSettings(container),
        },
        exportPage,
      ],
    };

    const embeddingPage: SettingsPageModel = {
      name: t("EMBED_TOEXCALIDRAW_HEAD"),
      description: t("EMBED_TOEXCALIDRAW_DESC"),
      buildDefinitions: () => [
        this.createYouTubeDefinition(t("PDF_TO_IMAGE"), "nB4cOfn0xAs"),
        ...this.toDeclarativeDefinitions(this.getPdfImportSpecs()),
      ],
      renderLegacy: (container) => this.renderPdfImportSettings(container),
      children: [
        {
          name: t("MD_EMBED_CUSTOMDATA_HEAD_NAME"),
          description: t("MD_EMBED_CUSTOMDATA_GROUP_DESC"),
          buildDefinitions: () =>
            this.getEmbeddableMarkdownDefaultsDefinitions(),
          renderLegacy: (container) =>
            this.renderEmbeddableMarkdownDefaults(container),
        },
        {
          name: t("MD_HEAD"),
          description: t("MD_GROUP_DESC"),
          buildDefinitions: () => this.getMarkdownImageDefaultDefinitions(),
          renderLegacy: (container) =>
            this.renderMarkdownImageDefaultSettings(container),
        },
      ],
    };

    const nonstandardPage: SettingsPageModel = {
      name: t("NONSTANDARD_HEAD"),
      description: t("NONSTANDARD_DESC"),
      buildDefinitions: () => this.getNonstandardDefinitions(),
      renderLegacy: (container) => this.renderNonstandardSettings(container),
    };

    return [embedExportPage, embeddingPage, nonstandardPage];
  }

  private getFontsAutomationAndCompatibilityPages(
    renderState: SettingsRenderState,
  ): SettingsPageModel[] {
    const fontsPage: SettingsPageModel = {
      name: t("FONTS_HEAD"),
      description: t("FONTS_DESC"),
      buildDefinitions: () => this.getLocalFontDefinitions(),
      renderLegacy: (container) => this.renderLocalFontSettings(container),
      children: [
        {
          name: t("OFFLINE_CJK_NAME"),
          description: t("OFFLINE_CJK_GROUP_DESC"),
          buildDefinitions: () => this.getOfflineCjkDefinitions(),
          renderLegacy: (container) => this.renderOfflineCjkSettings(container),
        },
      ],
    };

    const experimentalPage: SettingsPageModel = {
      name: t("EXPERIMENTAL_HEAD"),
      description: t("EXPERIMENTAL_DESC"),
      buildDefinitions: () => this.getExperimentalDefinitions(),
      renderLegacy: (container) => this.renderExperimentalSettings(container),
      children: [
        {
          name: t("TASKBONE_HEAD"),
          description: t("TASKBONE_GROUP_DESC"),
          buildDefinitions: () => this.getTaskboneDefinitions(),
          renderLegacy: (container) => this.renderTaskboneSettings(container),
        },
      ],
    };

    const automatePage: SettingsPageModel = {
      name: t("EA_HEAD"),
      description: t("EA_GROUP_DESC"),
      buildDefinitions: () => this.getAutomateDefinitions(),
      renderLegacy: (container) => this.renderAutomateSettings(container),
      children: [
        {
          name: t("SCRIPT_SETTINGS_HEAD"),
          description: t("SCRIPT_SETTINGS_DESC"),
          visible: () => this.hasInstalledScriptSettings(),
          buildDefinitions: () => this.getInstalledScriptDefinitions(),
          renderLegacy: (container) =>
            this.renderInstalledScriptSettings(container),
        },
      ],
    };

    const compatibilityPage: SettingsPageModel = {
      name: t("COMPATIBILITY_HEAD"),
      description: t("COMPATIBILITY_DESC"),
      buildDefinitions: () =>
        this.toDeclarativeDefinitions(
          this.getCompatibilitySpecs(renderState),
        ),
      renderLegacy: (container) =>
        this.renderSettingSpecs(
          container,
          this.getCompatibilitySpecs(renderState),
        ),
    };

    return [fontsPage, experimentalPage, automatePage, compatibilityPage];
  }

  private getAIPages(): SettingsPageModel[] {
    return [
      {
        name: t("AI_HEAD"),
        description: t("AI_DESC"),
        buildDefinitions: () => this.getAIDefinitions(),
        renderLegacy: (container) => this.renderAISettings(container),
      },
    ];
  }

  private getSettingsPages(): SettingsPageModel[] {
    const renderState: SettingsRenderState = {
      filenameSampleEl: null,
      gridColorSettingEl: null,
      todoPrefixSetting: null,
      donePrefixSetting: null,
      embedTypeDropdown: null,
      embedCommentSettingEl: null,
    };
    return [
      ...this.getBasicAndSavingPages(renderState),
      ...this.getAIPages(),
      ...this.getDisplayAndLinksPages(renderState),
      ...this.getEmbedAndExportPages(renderState),
      ...this.getFontsAutomationAndCompatibilityPages(renderState),
    ];
  }

  private toDeclarativePage(
    page: SettingsPageModel,
    parentPath: readonly string[] = [],
  ): SettingDefinitionItem<SettingBindingKey> {
    const pagePath = [...parentPath, page.name];
    const items = [
      ...(page.buildDefinitions?.() ?? []),
      ...(page.children?.map((child) =>
        this.toDeclarativePage(child, pagePath),
      ) ?? []),
    ];
    return {
      type: "page",
      name: page.name,
      desc: page.description,
      visible: page.visible,
      items: this.createDeclarativePageItems(
        pagePath,
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
    const visible =
      typeof page.visible === "function"
        ? page.visible()
        : (page.visible ?? true);
    if (!visible) {
      return;
    }
    if (headingLevel !== 1) {
      parent.createEl("hr", { cls: "excalidraw-setting-hr" });
    }
    parent.createDiv({
      text: page.description,
      cls: "setting-item-description",
    });
    const details = parent.createEl("details");
    if (page.legacyId) {
      details.setAttribute("id", page.legacyId);
    }
    details.createEl("summary", {
      text: page.name,
      cls: `excalidraw-setting-h${headingLevel}`,
    });

    page.renderLegacy?.(details);

    const childHeadingLevel = headingLevel === 1 ? 3 : 4;
    page.children?.forEach((child) =>
      this.renderLegacyPage(details, child, childHeadingLevel),
    );
  }

  private buildSettingDefinitions(
    registerBindings: boolean = true,
  ): SettingDefinitionItem<SettingBindingKey>[] {
    this.declarativePagePathsByTag = null;
    this.declarativeSettingsAdapter.beginBuild(registerBindings);
    return [
      this.createDeclarativeUtilitiesDefinition("Root", true),
      this.declarativeSettingsAdapter.toDefinition(
        this.getSettingsLayoutSpec(),
      ),
      ...this.getSettingsPages().map((page) =>
        this.toDeclarativePage(page),
      ),
    ];
  }
  /**
   * Returns the complete searchable settings tree when supported and selected.
   * Returning an empty array deliberately asks Obsidian to call {@link display}
   * for older versions or when the user selected the legacy single-page layout.
   */
  getSettingDefinitions(): SettingDefinitionItem<SettingBindingKey>[] {
    if (!this.useDeclarativeSettingsForSession) {
      this.declarativeSettingsAdapter.beginBuild();
      this.declarativeDefinitionsActive = false;
      return [];
    }
    const definitions = this.buildSettingDefinitions();
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
        await excalidrawView.reloadAfterSettingsChange();
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
    this.detachLegacySettingsCrossLinks();
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

    this.destroyHotkeyEditor();
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
    this.detachLegacySettingsCrossLinks();
    this.destroyFontPickers();
    this.destroyHotkeyEditor();
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
    this.renderLegacyPages(this.getSettingsPages());
    this.attachLegacySettingsCrossLinks();
  }

  private async copyDeclarativeSettingsAsMarkdown(): Promise<void> {
    // Build fresh fragments because Obsidian may consume a DocumentFragment
    // while rendering a page. Rebuilding also exports unopened pages.
    const definitions = this.buildSettingDefinitions(false);
    const markdown = declarativeSettingsToMarkdown(definitions);
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

  private renderLegacyPages(pages: readonly SettingsPageModel[]): void {
    for (const page of pages) {
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

  private renderFilenameInformation(
    container: HTMLElement,
    renderState: SettingsRenderState,
  ): void {
    const informationEl = container.createDiv(
      "excalidraw-filename-information",
    );
    informationEl.createDiv("", (el) => {
      setSanitizedHtml(el, t("FILENAME_DESC"));
    });
    renderState.filenameSampleEl = informationEl.createEl("p", { text: "" });
    setSanitizedHtml(renderState.filenameSampleEl, this.getFilenameSample());
  }

  private refreshFilenameSample(renderState: SettingsRenderState): void {
    if (renderState.filenameSampleEl?.isConnected) {
      setSanitizedHtml(
        renderState.filenameSampleEl,
        this.getFilenameSample(),
      );
    }
  }

  private getFilenameSpecs(renderState: SettingsRenderState): SettingSpec[] {
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
          after: () => this.refreshFilenameSample(renderState),
        },
      },
      {
        name: t("FILENAME_PREFIX_EMBED_NAME"),
        desc: fragWithHTML(t("FILENAME_PREFIX_EMBED_DESC")),
        control: {
          type: "toggle",
          key: "drawingEmbedPrefixWithFilename",
          after: () => this.refreshFilenameSample(renderState),
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
          after: () => this.refreshFilenameSample(renderState),
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
          after: () => this.refreshFilenameSample(renderState),
        },
      },
      {
        name: t("FILENAME_EXCALIDRAW_EXTENSION_NAME"),
        desc: fragWithHTML(t("FILENAME_EXCALIDRAW_EXTENSION_DESC")),
        aliases: [".excalidraw.md extension"],
        control: {
          type: "toggle",
          key: "useExcalidrawExtension",
          after: () => this.refreshFilenameSample(renderState),
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

  private isAIEnabled(): boolean {
    return this.plugin.settings.aiEnabled ?? true;
  }

  private configureAIEnabledSetting(
    setting: Setting,
    onChange?: (value: boolean) => void,
  ): void {
    setting
      .setName(t("AI_ENABLED_NAME"))
      .setDesc(fragWithHTML(t("AI_ENABLED_DESC")))
      .addToggle((toggle) =>
        toggle.setValue(this.isAIEnabled()).onChange((value) => {
          this.plugin.settings.aiEnabled = value;
          onChange?.(value);
          this.refreshDeclarativeDomState();
          this.applySettingsUpdate();
        }),
      );
  }

  private configureAIUsageSetting(setting: Setting): void {
    setting
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
  }

  private configureAINumberSetting(
    setting: Setting,
    name: string,
    desc: string,
    placeholder: string,
    getter: () => number,
    setter: (value: number) => void,
  ): void {
    setting
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
  }

  private getAIVerboseLoggingSpec(): SettingSpec {
    return {
      name: t("AI_VERBOSE_LOGGING_NAME"),
      desc: fragWithHTML(t("AI_VERBOSE_LOGGING_DESC")),
      aliases: ["AI diagnostics", "AI console logging"],
      control: { type: "toggle", key: "aiVerboseLogging" },
    };
  }

  private configureAIOutgoingTokenSetting(setting: Setting): void {
    this.configureAINumberSetting(
      setting,
      t("AI_PROVIDER_DEFAULT_MAX_OUTGOING_TOKENS_NAME"),
      t("AI_PROVIDER_DEFAULT_MAX_OUTGOING_TOKENS_DESC"),
      t("AI_PROVIDER_DEFAULT_MAX_OUTGOING_TOKENS_PLACEHOLDER"),
      () => this.plugin.settings.aiDefaultMaxOutgoingTokens,
      (value) => {
        this.plugin.settings.aiDefaultMaxOutgoingTokens = value;
      },
    );
  }

  private configureAIResponseTokenSetting(setting: Setting): void {
    this.configureAINumberSetting(
      setting,
      t("AI_PROVIDER_DEFAULT_MAX_RESPONSE_TOKENS_NAME"),
      t("AI_PROVIDER_DEFAULT_MAX_RESPONSE_TOKENS_DESC"),
      t("AI_PROVIDER_DEFAULT_MAX_RESPONSE_TOKENS_PLACEHOLDER"),
      () => this.plugin.settings.aiDefaultMaxResponseTokens,
      (value) => {
        this.plugin.settings.aiDefaultMaxResponseTokens = value;
      },
    );
  }

  private getAIDefinitions(): SettingDefinitionItem<SettingBindingKey>[] {
    const visible = () => this.isAIEnabled();
    return [
      this.createCustomSettingDefinition({
        name: t("AI_ENABLED_NAME"),
        desc: fragWithHTML(t("AI_ENABLED_DESC")),
        aliases: ["AI", "artificial intelligence"],
        controlType: "toggle",
        configure: (setting) => this.configureAIEnabledSetting(setting),
      }),
      this.createCustomSettingDefinition({
        name: t("AI_USAGE_SETTINGS_BUTTON_NAME"),
        desc: t("AI_USAGE_SETTINGS_BUTTON_DESC"),
        aliases: ["AI usage", "tokens", "session usage"],
        visible,
        controlType: "action",
        configure: (setting) => this.configureAIUsageSetting(setting),
      }),
      this.declarativeSettingsAdapter.toDefinition({
        ...this.getAIVerboseLoggingSpec(),
        visible,
      }),
      this.createRenderedDefinition({
        name: t("AI_PROVIDER_NAME"),
        desc: fragWithHTML(t("AI_PROVIDER_DESC")),
        aliases: [
          t("AI_PROVIDER_DEFAULT_TEXT_MODEL_NAME"),
          t("AI_PROVIDER_DEFAULT_IMAGE_MODEL_NAME"),
          t("AI_PROVIDER_ADD"),
          t("AI_PROVIDER_EDIT"),
          t("AI_MODEL_ADD"),
          t("AI_MODEL_EDIT"),
          "AI provider profiles",
          "API key",
          "OpenAI",
          "Anthropic",
          "Claude",
          "Google Gemini",
          "xAI Grok",
          "local AI",
          "text model",
          "multimodal model",
          "vision model",
          "image model",
          "model endpoint",
        ],
        visible,
        controlType: "provider and model editor",
        render: (container) => this.renderAIProviderAndModelSettings(container),
      }),
      this.createCustomSettingDefinition({
        name: t("AI_PROVIDER_DEFAULT_MAX_OUTGOING_TOKENS_NAME"),
        desc: fragWithHTML(t("AI_PROVIDER_DEFAULT_MAX_OUTGOING_TOKENS_DESC")),
        aliases: ["AI prompt token budget", "outgoing tokens"],
        visible,
        controlType: "number input",
        configure: (setting) => this.configureAIOutgoingTokenSetting(setting),
      }),
      this.createCustomSettingDefinition({
        name: t("AI_PROVIDER_DEFAULT_MAX_RESPONSE_TOKENS_NAME"),
        desc: fragWithHTML(t("AI_PROVIDER_DEFAULT_MAX_RESPONSE_TOKENS_DESC")),
        aliases: ["AI response limit", "response tokens", "max tokens"],
        visible,
        controlType: "number input",
        configure: (setting) => this.configureAIResponseTokenSetting(setting),
      }),
    ];
  }

  private renderAISettings(container: HTMLElement): void {
    const enabledSetting = new Setting(container);
    const aiEl = container.createDiv();
    this.configureAIEnabledSetting(enabledSetting, (value) => {
      if (value) {
        showElement(aiEl);
      } else {
        hideElement(aiEl);
      }
    });
    if (!this.isAIEnabled()) {
      hideElement(aiEl);
    }

    this.configureAIUsageSetting(new Setting(aiEl));

    this.buildSetting(aiEl, this.getAIVerboseLoggingSpec());

    this.renderAIProviderAndModelSettings(aiEl);
    this.configureAIOutgoingTokenSetting(new Setting(aiEl));
    this.configureAIResponseTokenSetting(new Setting(aiEl));
  }

  private renderAIProviderAndModelSettings(detailsEl: HTMLElement): void {
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

    renderAISettings();
  }

  private getDisplayEditorPreviewSpecs(): SettingSpec[] {
    return [
      {
        name: t("ENABLE_DOUBLE_CLICK_TEXT_EDITING_NAME"),
        aliases: ["double click text", "create text"],
        control: {
          type: "toggle",
          key: "disableDoubleClickTextEditing",
          negate: true,
        },
      },
      {
        name: t("DISABLE_CONTEXT_MENU_NAME"),
        desc: t("DISABLE_CONTEXT_MENU_DESC"),
        aliases: ["context menu", "right click menu"],
        control: { type: "toggle", key: "disableContextMenu", negate: true },
      },
      {
        name: t("SHOW_DRAWING_OR_MD_IN_READING_MODE_NAME"),
        desc: fragWithHTML(t("SHOW_DRAWING_OR_MD_IN_READING_MODE_DESC")),
        aliases: ["reading mode", "markdown reading mode", "render image"],
        control: { type: "toggle", key: "renderImageInMarkdownReadingMode" },
      },
      {
        name: t("SHOW_DRAWING_OR_MD_IN_HOVER_PREVIEW_NAME"),
        desc: fragWithHTML(t("SHOW_DRAWING_OR_MD_IN_HOVER_PREVIEW_DESC")),
        aliases: ["hover preview", "page preview", "render image"],
        control: {
          type: "toggle",
          key: "renderImageInHoverPreviewForMDNotes",
        },
      },
    ];
  }

  private renderDisplayEditorPreviewSettings(container: HTMLElement): void {
    const specs = this.getDisplayEditorPreviewSpecs();
    specs.forEach((spec) => {
      const setting = this.buildSetting(container, spec);
      if (
        spec.control.key === "renderImageInMarkdownReadingMode" &&
        setting !== undefined
      ) {
        setting.nameEl.setAttribute("id", TAG_MDREADINGMODE);
      }
    });
  }

  private getUIModeSpecs(): SettingSpec[] {
    return [
      {
        name: t("SHOW_TAB_TITLEBAR_BUTTONS"),
        aliases: ["tab buttons", "titlebar buttons"],
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
      },
      {
        name: t("DESKTOP_UI_MODE_NAME"),
        desc: t("DESKTOP_UI_MODE_DESC"),
        aliases: ["desktop mode", "full mode", "compact mode", "tray mode"],
        control: {
          type: "dropdown",
          key: "desktopUIMode",
          options: [
            { value: "full", label: t("MODE_FULL") },
            { value: "compact", label: t("MODE_COMPACT") },
            { value: "tray", label: t("MODE_TRAY") },
          ],
          after: () => {
            if (DEVICE.isDesktop) {
              setUIMode(this.app, this.plugin.settings);
            }
          },
        },
      },
      {
        name: t("TABLET_UI_MODE_NAME"),
        desc: t("TABLET_UI_MODE_DESC"),
        aliases: ["tablet mode", "full mode", "compact mode", "tray mode"],
        control: {
          type: "dropdown",
          key: "tabletUIMode",
          options: [
            { value: "full", label: t("MODE_FULL") },
            { value: "compact", label: t("MODE_COMPACT") },
            { value: "tray", label: t("MODE_TRAY") },
          ],
          after: () => {
            if (DEVICE.isTablet) {
              setUIMode(this.app, this.plugin.settings);
            }
          },
        },
      },
      {
        name: t("PHONE_UI_MODE_NAME"),
        desc: t("PHONE_UI_MODE_DESC"),
        aliases: [
          "phone mode",
          "mobile mode",
          "full mode",
          "compact mode",
          "tray mode",
        ],
        control: {
          type: "dropdown",
          key: "phoneUIMode",
          options: [
            { value: "full", label: t("MODE_FULL") },
            { value: "compact", label: t("MODE_COMPACT") },
            { value: "tray", label: t("MODE_TRAY") },
            { value: "mobile", label: t("MODE_PHONE") },
          ],
          after: () => {
            if (DEVICE.isPhone) {
              setUIMode(this.app, this.plugin.settings);
            }
          },
        },
      },
      {
        name: t("LEFTHANDED_MODE_NAME"),
        desc: fragWithHTML(t("LEFTHANDED_MODE_DESC")),
        aliases: ["left handed", "tray side"],
        control: {
          type: "toggle",
          key: "isLeftHanded",
          after: (value) => setLeftHandedMode(value),
        },
      },
    ];
  }

  private getThemeSpecs(): SettingSpec[] {
    return [
      {
        name: t("OVERRIDE_OBSIDIAN_FONT_SIZE_NAME"),
        desc: fragWithHTML(t("OVERRIDE_OBSIDIAN_FONT_SIZE_DESC")),
        aliases: ["font size", "editor text size", "Obsidian font size"],
        control: { type: "toggle", key: "overrideObsidianFontSize" },
      },
      {
        name: t("DYNAMICSTYLE_NAME"),
        desc: fragWithHTML(t("DYNAMICSTYLE_DESC")),
        aliases: ["dynamic styling", "canvas color", "interface color"],
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
      },
      {
        name: t("IFRAME_MATCH_THEME_NAME"),
        desc: fragWithHTML(t("IFRAME_MATCH_THEME_DESC")),
        aliases: ["markdown embed theme", "iframe theme"],
        control: {
          type: "toggle",
          key: "iframeMatchExcalidrawTheme",
          reload: true,
        },
      },
      {
        name: t("MATCH_THEME_NAME"),
        desc: fragWithHTML(t("MATCH_THEME_DESC")),
        aliases: ["new drawing theme", "Obsidian theme"],
        control: { type: "toggle", key: "matchTheme" },
      },
      {
        name: t("MATCH_THEME_ALWAYS_NAME"),
        desc: fragWithHTML(t("MATCH_THEME_ALWAYS_DESC")),
        aliases: ["existing drawing theme", "Obsidian theme"],
        control: { type: "toggle", key: "matchThemeAlways" },
      },
      {
        name: t("MATCH_THEME_TRIGGER_NAME"),
        desc: fragWithHTML(t("MATCH_THEME_TRIGGER_DESC")),
        aliases: ["theme change", "follow theme"],
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
      },
      {
        name: t("DEFAULT_OPEN_MODE_NAME"),
        desc: fragWithHTML(t("DEFAULT_OPEN_MODE_DESC")),
        aliases: ["default open mode", "normal", "zen", "view mode"],
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
      },
      {
        name: t("PHONE_FOOTER_SAFE_AREA_PADDING_NAME"),
        desc: fragWithHTML(t("PHONE_FOOTER_SAFE_AREA_PADDING_DESC")),
        aliases: ["phone footer", "safe area", "bottom padding"],
        control: {
          type: "toggle",
          key: "phoneFooterSafeAreaPadding",
          after: () => this.plugin.updateFooterSafeAreaPadding(),
        },
      },
      {
        name: t("TABLET_FOOTER_SAFE_AREA_PADDING_NAME"),
        desc: fragWithHTML(t("TABLET_FOOTER_SAFE_AREA_PADDING_DESC")),
        aliases: ["tablet footer", "safe area", "bottom padding"],
        control: {
          type: "toggle",
          key: "tabletFooterSafeAreaPadding",
          after: () => this.plugin.updateFooterSafeAreaPadding(),
        },
      },
    ];
  }

  private renderThemeSettings(container: HTMLElement): void {
    const specs = this.getThemeSpecs();
    this.renderSettingSpecs(container, specs.slice(0, 2));
    addYouTubeThumbnail(container, "fypDth_-8q0");
    this.renderSettingSpecs(container, specs.slice(2, 3));
    addYouTubeThumbnail(container, "ICpoyMv6KSs");
    this.renderSettingSpecs(container, specs.slice(3));
  }

  private getZoomAndPanSpecs(): SettingSpec[] {
    return [
      {
        name: t("PAN_WITH_RIGHT_MOUSE_BUTTON_NAME"),
        desc: fragWithHTML(t("PAN_WITH_RIGHT_MOUSE_BUTTON_DESC")),
        aliases: ["right click pan", "mouse pan"],
        control: {
          type: "toggle",
          key: "panWithRightMouseButton",
          reload: true,
        },
      },
      {
        name: t("DEFAULT_PINCHZOOM_NAME"),
        desc: fragWithHTML(t("DEFAULT_PINCHZOOM_DESC")),
        aliases: ["pinch zoom", "pen mode zoom", "touch zoom"],
        control: {
          type: "toggle",
          key: "allowPinchZoom",
        after: () =>
          getExcalidrawViews(this.app, true).forEach((excalidrawView) =>
              excalidrawView.updatePinchZoom(),
            ),
        },
      },
      {
        name: t("DEFAULT_WHEELZOOM_NAME"),
        desc: fragWithHTML(t("DEFAULT_WHEELZOOM_DESC")),
        aliases: ["wheel zoom", "mouse wheel", "scroll zoom"],
        control: {
          type: "toggle",
          key: "allowWheelZoom",
        after: () =>
          getExcalidrawViews(this.app, true).forEach((excalidrawView) =>
              excalidrawView.updateWheelZoom(),
            ),
        },
      },
      {
        name: t("ZOOM_TO_FIT_ONOPEN_NAME"),
        desc: fragWithHTML(t("ZOOM_TO_FIT_ONOPEN_DESC")),
        aliases: ["zoom to fit", "file open"],
        control: { type: "toggle", key: "zoomToFitOnOpen" },
      },
      {
        name: t("ZOOM_TO_FIT_NAME"),
        desc: fragWithHTML(t("ZOOM_TO_FIT_DESC")),
        aliases: ["zoom to fit", "view resize"],
        control: { type: "toggle", key: "zoomToFitOnResize" },
      },
      {
        name: t("ZOOM_TO_FIT_MAX_LEVEL_NAME"),
        desc: t("ZOOM_TO_FIT_MAX_LEVEL_DESC"),
        aliases: ["zoom to fit maximum", "zoom level"],
        control: {
          type: "slider",
          key: "zoomToFitMaxLevel",
        min: 0.5,
          max: 10,
          step: 0.5,
        },
      },
      {
        name: t("ZOOM_STEP_NAME"),
        desc: t("ZOOM_STEP_DESC"),
        aliases: ["zoom increment", "zoom step"],
        control: {
          type: "slider",
          key: "zoomStep",
        min: 1,
        max: 25,
          step: 1,
          scale: 100,
        },
      },
      {
        name: t("ZOOM_MIN_NAME"),
        desc: t("ZOOM_MIN_DESC"),
        aliases: ["minimum zoom", "zoom out"],
        control: {
          type: "slider",
          key: "zoomMin",
        min: 1,
        max: 50,
          step: 1,
          scale: 100,
        },
      },
      {
        name: t("ZOOM_MAX_NAME"),
        desc: t("ZOOM_MAX_DESC"),
        aliases: ["maximum zoom", "zoom in"],
        control: {
          type: "slider",
          key: "zoomMax",
        min: 500,
        max: 6000,
          step: 100,
          scale: 100,
        },
      },
    ];
  }

  private renderZoomAndPanSettings(container: HTMLElement): void {
    const specs = this.getZoomAndPanSpecs();
    this.renderSettingSpecs(container, specs.slice(0, 2));
    addYouTubeThumbnail(container, "rBarRfcSxNo", 107);
    this.renderSettingSpecs(container, specs.slice(2));
  }

  private getPenSpecs(): SettingSpec[] {
    return [
      {
        name: t("DEFAULT_PEN_MODE_NAME"),
        desc: fragWithHTML(t("DEFAULT_PEN_MODE_DESC")),
        aliases: ["pen mode", "stylus"],
        control: {
          type: "dropdown",
          key: "defaultPenMode",
        options: [
          { value: "never", label: t("DEFAULT_PEN_MODE_OPTION_NEVER") },
          { value: "mobile", label: t("DEFAULT_PEN_MODE_OPTION_MOBILE") },
            { value: "always", label: t("DEFAULT_PEN_MODE_OPTION_ALWAYS") },
          ],
        },
      },
      {
        name: t("DISABLE_DOUBLE_TAP_ERASER_NAME"),
        aliases: ["double tap eraser", "pen eraser"],
        control: { type: "toggle", key: "penModeDoubleTapEraser" },
      },
      {
        name: t("DISABLE_SINGLE_FINGER_PANNING_NAME"),
        aliases: ["single finger pan", "pen panning"],
        control: { type: "toggle", key: "penModeSingleFingerPanning" },
      },
      {
        name: t("SHOW_PEN_MODE_FREEDRAW_CROSSHAIR_NAME"),
        desc: fragWithHTML(t("SHOW_PEN_MODE_FREEDRAW_CROSSHAIR_DESC")),
        aliases: ["pen crosshair", "freedraw crosshair"],
        control: { type: "toggle", key: "penModeCrosshairVisible" },
      },
    ];
  }

  private createHotkeyEditorDefinition(): SettingDefinition<SettingBindingKey> {
    return this.createRenderedDefinition({
      name: t("HOTKEY_OVERRIDE_CONTROL_NAME"),
      desc: fragWithHTML(t("HOTKEY_OVERRIDE_DESC")),
      aliases: ["hotkey override", "keyboard shortcut", "key combination"],
      controlType: "hotkey editor",
      render: (container) => this.renderHotkeyEditor(container),
    });
  }

  private renderHotkeyEditor(container: HTMLElement): () => void {
    this.destroyHotkeyEditor();
    container.createSpan({}, (el) => {
      setSanitizedHtml(el, t("HOTKEY_OVERRIDE_DESC"));
    });
    const editor = new HotkeyEditor(
      container,
      this.plugin.settings,
      (requestReloadDrawings: boolean = false) =>
        this.applySettingsUpdate(requestReloadDrawings),
    );
    this.hotkeyEditor = editor;
    editor.onload();
    return () => this.disposeHotkeyEditor(editor);
  }

  private disposeHotkeyEditor(editor: HotkeyEditor): void {
    editor.unload();
    if (editor.isDirty) {
      this.plugin.registerHotkeyOverrides();
    }
    if (this.hotkeyEditor === editor) {
      this.hotkeyEditor = null;
    }
  }

  private destroyHotkeyEditor(): void {
    if (this.hotkeyEditor !== null) {
      this.disposeHotkeyEditor(this.hotkeyEditor);
    }
  }

  private updateGridColor(): void {
    getExcalidrawViews(this.app, true).forEach((excalidrawView) =>
      excalidrawView.updateGridColor(),
    );
  }

  private updateGridDirection(): void {
    getExcalidrawViews(this.app, true).forEach((excalidrawView) =>
      excalidrawView.updateGridDirection(
        this.plugin.settings.gridSettings.GRID_DIRECTION,
      ),
    );
  }

  private configureGridDirectionSetting(setting: Setting): void {
    setting
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
            this.plugin.settings.gridSettings.GRID_DIRECTION ??= {
              horizontal: true,
              vertical: true,
            };
            this.plugin.settings.gridSettings.GRID_DIRECTION.horizontal = value;
            this.applySettingsUpdate();
            this.updateGridDirection();
          }),
      )
      .addToggle((toggle) =>
        toggle
          .setTooltip(t("GRID_VERTICAL"))
          .setValue(
            this.plugin.settings.gridSettings.GRID_DIRECTION?.vertical ?? true,
          )
          .onChange((value) => {
            this.plugin.settings.gridSettings.GRID_DIRECTION ??= {
              horizontal: true,
              vertical: true,
            };
            this.plugin.settings.gridSettings.GRID_DIRECTION.vertical = value;
            this.applySettingsUpdate();
            this.updateGridDirection();
          }),
      );
  }

  private configureDynamicGridColorSetting(
    setting: Setting,
    renderState: SettingsRenderState,
  ): void {
    setting
      .setName(t("GRID_DYNAMIC_COLOR_NAME"))
      .setDesc(fragWithHTML(t("GRID_DYNAMIC_COLOR_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.gridSettings.DYNAMIC_COLOR)
          .onChange((value) => {
            this.plugin.settings.gridSettings.DYNAMIC_COLOR = value;
            if (
              renderState.gridColorSettingEl &&
              renderState.gridColorSettingEl.isConnected
            ) {
              if (value) {
                hideElement(renderState.gridColorSettingEl);
              } else {
                showElement(renderState.gridColorSettingEl);
              }
            }
            this.applySettingsUpdate();
            this.updateGridColor();
            this.refreshDeclarativeDomState();
          }),
      );
  }

  private configureGridColorSetting(
    setting: Setting,
    renderState: SettingsRenderState,
  ): void {
    renderState.gridColorSettingEl = setting.settingEl;
    setting.setName(t("GRID_COLOR_NAME")).addColorPicker((colorPicker) =>
      colorPicker
        .setValue(this.plugin.settings.gridSettings.COLOR)
        .onChange((value) => {
          this.plugin.settings.gridSettings.COLOR = value;
          this.applySettingsUpdate();
          this.updateGridColor();
        }),
    );
    if (this.plugin.settings.gridSettings.DYNAMIC_COLOR) {
      hideElement(setting.settingEl);
    } else {
      showElement(setting.settingEl);
    }
  }

  private configureGridOpacitySetting(setting: Setting): void {
    configureSliderWithText(setting, {
      name: t("GRID_OPACITY_NAME"),
      desc: t("GRID_OPACITY_DESC"),
      value: this.plugin.settings.gridSettings.OPACITY,
      min: 0,
      max: 100,
      step: 1,
      minWidth: "3em",
      onChange: (value) => {
        this.plugin.settings.gridSettings.OPACITY = value;
        this.applySettingsUpdate();
        this.updateGridColor();
      },
    });
  }

  private getGridDefinitions(
    renderState: SettingsRenderState,
  ): SettingDefinitionItem<SettingBindingKey>[] {
    return [
      this.createCustomSettingDefinition({
        name: t("GRID_DIRECTION_NAME"),
        desc: t("GRID_DIRECTION_DESC"),
        aliases: ["horizontal grid", "vertical grid", "grid direction"],
        controlType: "toggle group",
        configure: (setting) => this.configureGridDirectionSetting(setting),
      }),
      this.createCustomSettingDefinition({
        name: t("GRID_DYNAMIC_COLOR_NAME"),
        desc: fragWithHTML(t("GRID_DYNAMIC_COLOR_DESC")),
        aliases: ["automatic grid color", "canvas color"],
        controlType: "toggle",
        configure: (setting) =>
          this.configureDynamicGridColorSetting(setting, renderState),
      }),
      this.createCustomSettingDefinition({
        name: t("GRID_COLOR_NAME"),
        aliases: ["custom grid color"],
        visible: () => !this.plugin.settings.gridSettings.DYNAMIC_COLOR,
        controlType: "color picker",
        configure: (setting) =>
          this.configureGridColorSetting(setting, renderState),
      }),
      this.createCustomSettingDefinition({
        name: t("GRID_OPACITY_NAME"),
        desc: t("GRID_OPACITY_DESC"),
        aliases: ["grid transparency"],
        controlType: "slider",
        configure: (setting) => this.configureGridOpacitySetting(setting),
      }),
    ];
  }

  private renderGridSettings(
    container: HTMLElement,
    renderState: SettingsRenderState,
  ): void {
    this.configureGridDirectionSetting(new Setting(container));
    this.configureDynamicGridColorSetting(
      new Setting(container),
      renderState,
    );
    this.configureGridColorSetting(new Setting(container), renderState);
    this.configureGridOpacitySetting(new Setting(container));
  }

  private configureLaserColorSetting(setting: Setting): void {
    setting.setName(t("LASER_COLOR")).addColorPicker((colorPicker) =>
      colorPicker
        .setValue(this.plugin.settings.laserSettings.COLOR)
        .onChange((value) => {
          this.plugin.settings.laserSettings.COLOR = value;
          this.applySettingsUpdate();
        }),
    );
  }

  private configureLaserDecayTimeSetting(setting: Setting): void {
    configureSliderWithText(setting, {
      name: t("LASER_DECAY_TIME_NAME"),
      desc: t("LASER_DECAY_TIME_DESC"),
      value: this.plugin.settings.laserSettings.DECAY_TIME,
      min: 500,
      max: 20000,
      step: 500,
      minWidth: "3em",
      onChange: (value) => {
        this.plugin.settings.laserSettings.DECAY_TIME = value;
        this.applySettingsUpdate();
      },
    });
  }

  private configureLaserDecayLengthSetting(setting: Setting): void {
    configureSliderWithText(setting, {
      name: t("LASER_DECAY_LENGTH_NAME"),
      desc: t("LASER_DECAY_LENGTH_DESC"),
      value: this.plugin.settings.laserSettings.DECAY_LENGTH,
      min: 25,
      max: 2000,
      step: 25,
      minWidth: "3em",
      onChange: (value) => {
        this.plugin.settings.laserSettings.DECAY_LENGTH = value;
        this.applySettingsUpdate();
      },
    });
  }

  private getLaserDefinitions(): SettingDefinitionItem<SettingBindingKey>[] {
    return [
      this.createCustomSettingDefinition({
        name: t("LASER_COLOR"),
        aliases: ["laser pointer color"],
        controlType: "color picker",
        configure: (setting) => this.configureLaserColorSetting(setting),
      }),
      this.createCustomSettingDefinition({
        name: t("LASER_DECAY_TIME_NAME"),
        desc: t("LASER_DECAY_TIME_DESC"),
        aliases: ["laser duration", "laser time"],
        controlType: "slider",
        configure: (setting) => this.configureLaserDecayTimeSetting(setting),
      }),
      this.createCustomSettingDefinition({
        name: t("LASER_DECAY_LENGTH_NAME"),
        desc: t("LASER_DECAY_LENGTH_DESC"),
        aliases: ["laser trail", "laser length"],
        controlType: "slider",
        configure: (setting) => this.configureLaserDecayLengthSetting(setting),
      }),
    ];
  }

  private renderLaserSettings(container: HTMLElement): void {
    this.configureLaserColorSetting(new Setting(container));
    this.configureLaserDecayTimeSetting(new Setting(container));
    this.configureLaserDecayLengthSetting(new Setting(container));
  }

  private getLinkOpeningGestureSpecs(): SettingSpec[] {
    return [
      {
        name: t("LONG_PRESS_DESKTOP_NAME"),
        desc: t("LONG_PRESS_DESKTOP_DESC"),
        aliases: ["long press desktop", "embedded drawing"],
        control: {
          type: "slider",
          key: "longPressDesktop",
        min: 300,
        max: 3000,
          step: 100,
          reload: true,
        },
      },
      {
        name: t("LONG_PRESS_MOBILE_NAME"),
        desc: t("LONG_PRESS_MOBILE_DESC"),
        aliases: ["long press mobile", "embedded drawing"],
        control: {
          type: "slider",
          key: "longPressMobile",
        min: 300,
        max: 3000,
          step: 100,
          reload: true,
        },
      },
      {
        name: t("DOUBLE_CLICK_LINK_OPEN_VIEW_MODE"),
        aliases: ["double click link", "view mode link"],
        control: { type: "toggle", key: "doubleClickLinkOpenViewMode" },
      },
    ];
  }

  private getModifierKeyCategoryDescription(
    modifierSetType: ModifierSetType,
  ): string {
    switch (modifierSetType) {
      case "WebBrowserDragAction":
        return t("WEB_BROWSER_DRAG_ACTION_DESC");
      case "LocalFileDragAction":
        return t("LOCAL_FILE_DRAG_ACTION_DESC");
      case "InternalDragAction":
        return t("INTERNAL_DRAG_ACTION_DESC");
      case "LinkClickAction":
        return t("PANE_TARGET_DESC");
    }
  }

  private createModifierKeyUsageDefinition(): SettingDefinition<SettingBindingKey> {
    return this.createRenderedDefinition({
      name: t("MODIFIER_KEY_USAGE_NAME"),
      desc: t("DRAG_MODIFIER_DESC"),
      aliases: [
        "modifier key",
        "shift",
        "control",
        "command",
        "alt",
        "option",
        "meta",
      ],
      controlType: "information",
      render: (container) => this.renderModifierKeyUsage(container),
    });
  }

  private renderModifierKeyUsage(container: HTMLElement): void {
    container.createDiv({
      text: t("DRAG_MODIFIER_DESC"),
      cls: "setting-item-description",
    });
  }

  private createModifierKeyCategoryDefinition(
    modifierSetType: ModifierSetType,
  ): SettingDefinition<SettingBindingKey> {
    const categoryName = getModifierKeyCategoryName(modifierSetType);
    const actionAliases = Object.values(
      modifierKeyTooltipMessages()[modifierSetType] ?? {},
    ).filter((value): value is string => typeof value === "string");
    return this.createRenderedDefinition({
      name: categoryName + " · " + t("MODIFIER_KEY_COMBINATIONS"),
      desc: this.getModifierKeyCategoryDescription(modifierSetType),
      aliases: [
        categoryName,
        ...actionAliases,
        "shift",
        "control",
        "command",
        "alt",
        "option",
        "meta",
      ],
      controlType: "modifier toggle matrix",
      render: (container) =>
        this.renderModifierKeyCategory(container, modifierSetType),
    });
  }

  private renderModifierKeyCategory(
    container: HTMLElement,
    modifierSetType: ModifierSetType,
  ): void {
    new ModifierKeySettingsComponent(
      container,
      this.plugin.settings.modifierKeyConfig,
      () => this.applySettingsUpdate(),
    ).renderCategory(modifierSetType, false);
  }

  private createLinkUsageDefinition(): SettingDefinition<SettingBindingKey> {
    return this.createRenderedDefinition({
      name: t("LINK_USAGE_NAME"),
      desc: fragWithHTML(t("LINKS_DESC")),
      aliases: ["wiki link", "web link", "ctrl click", "link alias"],
      controlType: "information",
      render: (container) => {
        container.createSpan({}, (el) => setSanitizedHtml(el, t("LINKS_DESC")));
      },
    });
  }

  private getLinkBehaviorSpecs(): SettingSpec[] {
    return [
      {
        name: t("ELEMENT_LINK_SYNC_NAME"),
        desc: fragWithHTML(t("ELEMENT_LINK_SYNC_DESC")),
        aliases: ["element link", "text link", "sync link"],
        control: { type: "toggle", key: "syncElementLinkWithText" },
      },
      {
        name: t("SECOND_ORDER_LINKS_NAME"),
        desc: fragWithHTML(t("SECOND_ORDER_LINKS_DESC")),
        aliases: ["second order link", "backlink"],
        control: { type: "toggle", key: "showSecondOrderLinks" },
      },
      {
        name: t("HOVERPREVIEW_NAME"),
        desc: fragWithHTML(t("HOVERPREVIEW_DESC")),
        aliases: ["hover preview", "link preview"],
        control: { type: "toggle", key: "hoverPreviewWithoutCTRL" },
      },
      {
        name: t("LINK_CTRL_CLICK_NAME"),
        desc: fragWithHTML(t("LINK_CTRL_CLICK_DESC")),
        aliases: ["ctrl click", "command click", "open link"],
        control: { type: "toggle", key: "allowCtrlClick" },
      },
      {
        name: t("GET_URL_TITLE_NAME"),
        desc: fragWithHTML(t("GET_URL_TITLE_DESC")),
        aliases: ["oEmbed", "URL title", "web page title"],
        control: { type: "toggle", key: "oEmbedAllowed" },
      },
    ];
  }

  private renderLinkBehaviorSettings(container: HTMLElement): void {
    container.createSpan({}, (el) => setSanitizedHtml(el, t("LINKS_DESC")));
    this.renderSettingSpecs(container, this.getLinkBehaviorSpecs());
  }

  private getLinkOpeningSpecs(): SettingSpec[] {
    return [
      {
        name: t("ADJACENT_PANE_NAME"),
        desc: fragWithHTML(t("ADJACENT_PANE_DESC")),
        aliases: ["adjacent pane", "reuse pane"],
        control: { type: "toggle", key: "openInAdjacentPane" },
      },
      {
        name: t("FOCUS_ON_EXISTING_TAB_NAME"),
        desc: fragWithHTML(t("FOCUS_ON_EXISTING_TAB_DESC")),
        aliases: ["existing tab", "focus tab"],
        control: { type: "toggle", key: "focusOnFileTab" },
      },
      {
        name: t("MAINWORKSPACE_PANE_NAME"),
        desc: fragWithHTML(t("MAINWORKSPACE_PANE_DESC")),
        aliases: ["main workspace", "popout link"],
        control: { type: "toggle", key: "openInMainWorkspace" },
      },
    ];
  }

  private getLinkAppearanceSpecs(): SettingSpec[] {
    return [
      {
        name: fragWithHTML(t("LINK_BRACKETS_NAME")),
        desc: fragWithHTML(t("LINK_BRACKETS_DESC")),
        aliases: ["wiki link brackets", "preview brackets"],
        control: { type: "toggle", key: "showLinkBrackets", reload: true },
      },
      {
        name: t("LINK_PREFIX_NAME"),
        desc: fragWithHTML(t("LINK_PREFIX_DESC")),
        aliases: ["link icon", "link emoji", "link prefix"],
        control: {
          type: "text",
          key: "linkPrefix",
          placeholder: t("INSERT_EMOJI"),
          reload: true,
        },
      },
      {
        name: t("URL_PREFIX_NAME"),
        desc: fragWithHTML(t("URL_PREFIX_DESC")),
        aliases: ["URL icon", "URL emoji", "web link prefix"],
        control: {
          type: "text",
          key: "urlPrefix",
          placeholder: t("INSERT_EMOJI"),
          reload: true,
        },
      },
      {
        name: t("LINKOPACITY_NAME"),
        desc: t("LINKOPACITY_DESC"),
        aliases: ["link icon opacity", "link transparency"],
        control: {
          type: "slider",
          key: "linkOpacity",
          min: 0,
          max: 1,
          step: 0.05,
          reload: true,
        },
      },
    ];
  }

  private getTodoSpecs(renderState: SettingsRenderState): SettingSpec[] {
    return [
      {
        name: t("PARSE_TODO_NAME"),
        desc: fragWithHTML(t("PARSE_TODO_DESC")),
        aliases: ["todo checkbox", "task checkbox", "parse task"],
        control: {
          type: "toggle",
          key: "parseTODO",
          after: (value) => {
            renderState.todoPrefixSetting?.setDisabled(!value);
            renderState.donePrefixSetting?.setDisabled(!value);
          },
          reload: true,
        },
      },
      {
        name: t("TODO_NAME"),
        desc: fragWithHTML(t("TODO_DESC")),
        aliases: ["open todo", "todo icon", "unchecked task"],
        control: {
          type: "text",
          key: "todo",
          placeholder: t("INSERT_EMOJI"),
          capture: (text) => {
            renderState.todoPrefixSetting = text;
          },
          disabled: () => !this.plugin.settings.parseTODO,
          reload: true,
        },
      },
      {
        name: t("DONE_NAME"),
        desc: fragWithHTML(t("DONE_DESC")),
        aliases: ["completed todo", "done icon", "checked task"],
        control: {
          type: "text",
          key: "done",
          placeholder: t("INSERT_EMOJI"),
          capture: (text) => {
            renderState.donePrefixSetting = text;
          },
          disabled: () => !this.plugin.settings.parseTODO,
          reload: true,
        },
      },
    ];
  }

  private getTransclusionToggleSpecs(): SettingSpec[] {
    return [
      {
        name: t("TRANSCLUSION_WRAP_NAME"),
        desc: fragWithHTML(
          "<code>![[doc#^ref]]{number}</code> " + t("TRANSCLUSION_WRAP_DESC"),
        ),
        aliases: ["transclusion wrap", "force wrap", "overflow"],
        control: { type: "toggle", key: "forceWrap", reload: true },
      },
      {
        name: t("QUOTE_TRANSCLUSION_REMOVE_NAME"),
        desc: fragWithHTML(t("QUOTE_TRANSCLUSION_REMOVE_DESC")),
        aliases: ["quote transclusion", "remove quote signs"],
        control: {
          type: "toggle",
          key: "removeTransclusionQuoteSigns",
          after: () => {
            this.requestEmbedUpdate = true;
          },
          reload: true,
        },
      },
    ];
  }

  private configureIntegerTextSetting(
    setting: Setting,
    options: {
      name: string;
      desc: string | DocumentFragment;
      key:
        | "pageTransclusionCharLimit"
        | "wordWrappingDefault"
        | "mdSVGwidth"
        | "mdSVGmaxHeight";
      emptyValue: number;
      placeholder?: string;
    },
  ): void {
    setting
      .setName(options.name)
      .setDesc(options.desc)
      .addText((text) =>
        text
          .setPlaceholder(options.placeholder ?? "Enter a number")
          .setValue(this.plugin.settings[options.key].toString())
          .onChange((value) => {
            const parsedValue = parseInt(value, 10);
            if (isNaN(parsedValue) && value !== "") {
              text.setValue(this.plugin.settings[options.key].toString());
              return;
            }
            this.requestEmbedUpdate = true;
            if (value === "") {
              this.plugin.settings[options.key] = options.emptyValue;
              this.applySettingsUpdate(true);
              return;
            }
            this.plugin.settings[options.key] = parsedValue;
            text.setValue(parsedValue.toString());
            this.applySettingsUpdate(true);
          }),
      );
  }

  private createPageTransclusionLimitDefinition(): SettingDefinition<SettingBindingKey> {
    return this.createCustomSettingDefinition({
      name: t("PAGE_TRANSCLUSION_CHARCOUNT_NAME"),
      desc: fragWithHTML(t("PAGE_TRANSCLUSION_CHARCOUNT_DESC")),
      aliases: ["page transclusion limit", "maximum characters"],
      controlType: "number input",
      configure: (setting) =>
        this.configureIntegerTextSetting(setting, {
          name: t("PAGE_TRANSCLUSION_CHARCOUNT_NAME"),
          desc: fragWithHTML(t("PAGE_TRANSCLUSION_CHARCOUNT_DESC")),
          key: "pageTransclusionCharLimit",
          emptyValue: 10,
        }),
    });
  }

  private createTransclusionWrapDefaultDefinition(): SettingDefinition<SettingBindingKey> {
    return this.createCustomSettingDefinition({
      name: t("TRANSCLUSION_DEFAULT_WRAP_NAME"),
      desc: fragWithHTML(t("TRANSCLUSION_DEFAULT_WRAP_DESC")),
      aliases: ["transclusion wrap default", "word wrap length"],
      controlType: "number input",
      configure: (setting) =>
        this.configureIntegerTextSetting(setting, {
          name: t("TRANSCLUSION_DEFAULT_WRAP_NAME"),
          desc: fragWithHTML(t("TRANSCLUSION_DEFAULT_WRAP_DESC")),
          key: "wordWrappingDefault",
          emptyValue: 0,
        }),
    });
  }

  private getTransclusionDefinitions(): SettingDefinitionItem<SettingBindingKey>[] {
    const specs = this.getTransclusionToggleSpecs();
    return [
      this.declarativeSettingsAdapter.toDefinition(specs[0]),
      this.createPageTransclusionLimitDefinition(),
      this.createTransclusionWrapDefaultDefinition(),
      this.declarativeSettingsAdapter.toDefinition(specs[1]),
    ];
  }

  private renderTransclusionSettings(container: HTMLElement): void {
    const specs = this.getTransclusionToggleSpecs();
    this.buildSetting(container, specs[0]);
    this.configureIntegerTextSetting(new Setting(container), {
      name: t("PAGE_TRANSCLUSION_CHARCOUNT_NAME"),
      desc: fragWithHTML(t("PAGE_TRANSCLUSION_CHARCOUNT_DESC")),
      key: "pageTransclusionCharLimit",
      emptyValue: 10,
    });
    this.configureIntegerTextSetting(new Setting(container), {
      name: t("TRANSCLUSION_DEFAULT_WRAP_NAME"),
      desc: fragWithHTML(t("TRANSCLUSION_DEFAULT_WRAP_DESC")),
      key: "wordWrappingDefault",
      emptyValue: 0,
    });
    this.buildSetting(container, specs[1]);
  }

  private getEmbedPreviewSpecs(): SettingSpec[] {
    return [
      {
        name: t("EMBED_PREVIEW_IMAGETYPE_NAME"),
        desc: fragWithHTML(t("EMBED_PREVIEW_IMAGETYPE_DESC")),
        aliases: ["markdown preview", "native SVG", "SVG image", "PNG"],
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
      },
      {
        name: t("EMBED_WIKILINK_NAME"),
        desc: fragWithHTML(t("EMBED_WIKILINK_DESC")),
        aliases: ["wiki link", "markdown link", "embed drawing link"],
        control: { type: "toggle", key: "embedWikiLink" },
      },
      {
        name: t("EMBED_PLACEHOLDER_NAME"),
        desc: fragWithHTML(t("EMBED_PLACEHOLDER_DESC")),
        aliases: ["placeholder image", "missing drawing"],
        control: { type: "toggle", key: "embedPlaceholderImage" },
      },
      {
        name: t("EMBED_CANVAS_NAME"),
        desc: fragWithHTML(t("EMBED_CANVAS_DESC")),
        aliases: ["Obsidian Canvas", "immersive embed", "canvas border"],
        control: { type: "toggle", key: "canvasImmersiveEmbed" },
      },
    ];
  }

  private isEmbedTypeAvailable(
    embedType: "excalidraw" | "PNG" | "SVG",
  ): boolean {
    return (
      embedType === "excalidraw" ||
      (embedType === "PNG" && this.plugin.settings.autoexportPNG) ||
      (embedType === "SVG" && this.plugin.settings.autoexportSVG)
    );
  }

  private normalizeEmbedType(): void {
    if (this.isEmbedTypeAvailable(this.plugin.settings.embedType)) {
      return;
    }
    this.plugin.settings.embedType = "excalidraw";
    this.applySettingsUpdate();
  }

  private updateEmbedCommentVisibility(
    renderState: SettingsRenderState,
  ): void {
    if (!renderState.embedCommentSettingEl?.isConnected) {
      return;
    }
    if (this.plugin.settings.embedType === "excalidraw") {
      hideElement(renderState.embedCommentSettingEl);
    } else {
      showElement(renderState.embedCommentSettingEl);
    }
  }

  private configureEmbedTypeSetting(
    setting: Setting,
    renderState: SettingsRenderState,
  ): void {
    this.normalizeEmbedType();
    setting
      .setName(t("EMBED_TYPE_NAME"))
      .setDesc(fragWithHTML(t("EMBED_TYPE_DESC")))
      .addDropdown((dropdown) => {
        renderState.embedTypeDropdown = dropdown;
        dropdown.addOption("excalidraw", "Excalidraw");
        if (this.plugin.settings.autoexportPNG) {
          dropdown.addOption("PNG", "PNG");
        }
        if (this.plugin.settings.autoexportSVG) {
          dropdown.addOption("SVG", "SVG");
        }
        dropdown
          .setValue(this.plugin.settings.embedType)
          .onChange((value) => {
            this.plugin.settings.embedType =
              value as typeof this.plugin.settings.embedType;
            this.updateEmbedCommentVisibility(renderState);
            this.refreshDeclarativeDomState();
            this.applySettingsUpdate();
          });
      });
  }

  private createEmbedTypeDefinition(
    renderState: SettingsRenderState,
  ): SettingDefinition<SettingBindingKey> {
    return this.createCustomSettingDefinition({
      name: t("EMBED_TYPE_NAME"),
      desc: fragWithHTML(t("EMBED_TYPE_DESC")),
      aliases: ["insert Excalidraw", "insert PNG", "insert SVG"],
      controlType: "dropdown",
      configure: (setting) =>
        this.configureEmbedTypeSetting(setting, renderState),
    });
  }

  private configureEmbedCommentSetting(
    setting: Setting,
    renderState: SettingsRenderState,
  ): void {
    renderState.embedCommentSettingEl = setting.settingEl;
    this.legacySettingsAdapter.configure(setting, {
      name: t("EMBED_MARKDOWN_COMMENT_NAME"),
      desc: fragWithHTML(t("EMBED_MARKDOWN_COMMENT_DESC")),
      control: { type: "toggle", key: "embedMarkdownCommentLinks" },
    });
    this.updateEmbedCommentVisibility(renderState);
  }

  private createEmbedCommentDefinition(
    renderState: SettingsRenderState,
  ): SettingDefinition<SettingBindingKey> {
    return this.createCustomSettingDefinition({
      name: t("EMBED_MARKDOWN_COMMENT_NAME"),
      desc: fragWithHTML(t("EMBED_MARKDOWN_COMMENT_DESC")),
      aliases: ["drawing source comment", "original Excalidraw link"],
      visible: () => this.plugin.settings.embedType !== "excalidraw",
      controlType: "toggle",
      configure: (setting) =>
        this.configureEmbedCommentSetting(setting, renderState),
    });
  }

  private getEmbedPreviewDefinitions(
    renderState: SettingsRenderState,
  ): SettingDefinitionItem<SettingBindingKey>[] {
    const specs = this.getEmbedPreviewSpecs();
    return [
      this.declarativeSettingsAdapter.toDefinition(specs[0]),
      this.createYouTubeDefinition(
        t("EMBED_PREVIEW_IMAGETYPE_NAME"),
        "yZQoJg2RCKI",
      ),
      this.createYouTubeDefinition(
        t("EMBED_PREVIEW_IMAGETYPE_NAME"),
        "opLd1SqaH_I",
        8,
      ),
      this.createEmbedTypeDefinition(renderState),
      this.createRelatedSettingsPageDefinition({
        key: "inserted file type to auto-export",
        name: t("EXPORT_HEAD"),
        description: t("SETTINGS_RELATED_AUTOEXPORT_DESC"),
        targetTag: TAG_AUTOEXPORT,
      }),
      this.createEmbedCommentDefinition(renderState),
      ...this.toDeclarativeDefinitions(specs.slice(1)),
    ];
  }

  private renderEmbedPreviewSettings(
    container: HTMLElement,
    renderState: SettingsRenderState,
  ): void {
    const specs = this.getEmbedPreviewSpecs();
    this.buildSetting(container, specs[0]);
    addYouTubeThumbnail(container, "yZQoJg2RCKI");
    addYouTubeThumbnail(container, "opLd1SqaH_I", 8);
    this.configureEmbedTypeSetting(new Setting(container), renderState);
    this.configureEmbedCommentSetting(new Setting(container), renderState);
    this.renderSettingSpecs(container, specs.slice(1));
  }

  private getEmbedCacheSpecs(): SettingSpec[] {
    return [
      {
        name: t("RENDERING_CONCURRENCY_NAME"),
        desc: t("RENDERING_CONCURRENCY_DESC"),
        aliases: ["render workers", "parallel image rendering"],
        control: {
          type: "slider",
          key: "renderingConcurrency",
          min: 1,
          max: 5,
          step: 1,
        },
      },
      {
        name: t("IMAGE_CACHE_RETENTION_DAYS_NAME"),
        desc: fragWithHTML(t("IMAGE_CACHE_RETENTION_DAYS_DESC")),
        aliases: ["cache retention", "cache expiry", "local storage"],
        control: {
          type: "slider",
          key: "imageCacheRetentionDays",
          min: 1,
          max: 365,
          step: 1,
          minWidth: "3em",
        },
      },
      {
        name: t("EMBED_IMAGE_CACHE_NAME"),
        desc: fragWithHTML(t("EMBED_IMAGE_CACHE_DESC")),
        aliases: ["markdown image cache", "preview cache"],
        control: { type: "toggle", key: "allowImageCache" },
      },
      {
        name: t("SCENE_IMAGE_CACHE_NAME"),
        desc: fragWithHTML(t("SCENE_IMAGE_CACHE_DESC")),
        aliases: ["nested Excalidraw cache", "scene cache"],
        control: { type: "toggle", key: "allowImageCacheInScene" },
      },
      {
        name: t("EMBED_REUSE_EXPORTED_IMAGE_NAME"),
        desc: fragWithHTML(t("EMBED_REUSE_EXPORTED_IMAGE_DESC")),
        aliases: ["reuse exported image", "faster preview"],
        control: {
          type: "toggle",
          key: "displayExportedImageIfAvailable",
        },
      },
    ];
  }

  private configureClearImageCacheSetting(setting: Setting): void {
    setting
      .setName(t("EMBED_IMAGE_CACHE_CLEAR"))
      .addButton((button) =>
        button.setButtonText(t("EMBED_IMAGE_CACHE_CLEAR")).onClick(() => {
          void getImageCache().clearImageCache();
        }),
      );
  }

  private configureClearBackupCacheSetting(setting: Setting): void {
    setting.setName(t("BACKUP_CACHE_CLEAR")).addButton((button) =>
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
  }

  private getEmbedCacheDefinitions(): SettingDefinitionItem<SettingBindingKey>[] {
    const specs = this.getEmbedCacheSpecs();
    return [
      ...this.toDeclarativeDefinitions(specs.slice(0, 4)),
      this.createCustomSettingDefinition({
        name: t("EMBED_IMAGE_CACHE_CLEAR"),
        aliases: ["purge image cache", "clear image cache"],
        controlType: "action button",
        configure: (setting) => this.configureClearImageCacheSetting(setting),
      }),
      this.createCustomSettingDefinition({
        name: t("BACKUP_CACHE_CLEAR"),
        aliases: ["purge drawing backups", "clear backups"],
        controlType: "action button",
        configure: (setting) => this.configureClearBackupCacheSetting(setting),
      }),
      this.declarativeSettingsAdapter.toDefinition(specs[4]),
    ];
  }

  private renderEmbedCacheSettings(container: HTMLElement): void {
    const specs = this.getEmbedCacheSpecs();
    this.renderSettingSpecs(container, specs.slice(0, 4));
    this.configureClearImageCacheSetting(new Setting(container));
    this.configureClearBackupCacheSetting(new Setting(container));
    this.buildSetting(container, specs[4]);
  }

  private getExportGeneralSpecs(): SettingSpec[] {
    return [
      {
        name: t("SHOW_DRAWING_OR_MD_IN_EXPORTPDF_NAME"),
        desc: fragWithHTML(t("SHOW_DRAWING_OR_MD_IN_EXPORTPDF_DESC")),
        aliases: ["PDF export", "render drawing in PDF"],
        control: { type: "toggle", key: "renderImageInMarkdownToPDF" },
      },
      {
        name: t("EXPORT_EMBED_SCENE_NAME"),
        desc: fragWithHTML(t("EXPORT_EMBED_SCENE_DESC")),
        aliases: ["embed scene", "editable exported SVG", "editable PNG"],
        control: { type: "toggle", key: "exportEmbedScene" },
      },
    ];
  }

  private renderExportGeneralSettings(container: HTMLElement): void {
    addYouTubeThumbnail(container, "wTtaXmRJ7wg", 171);
    const specs = this.getExportGeneralSpecs();
    const pdfExportSetting = this.buildSetting(container, specs[0]);
    pdfExportSetting?.nameEl.setAttribute("id", TAG_PDFEXPORT);
    this.buildSetting(container, specs[1]);
  }

  private getExportSizingSpecs(): SettingSpec[] {
    return [
      {
        name: t("EMBED_WIDTH_NAME"),
        desc: fragWithHTML(t("EMBED_WIDTH_DESC")),
        aliases: ["default embed width", "transcluded image width"],
        control: {
          type: "text",
          key: "width",
          placeholder: "400",
          afterUpdate: () => {
            this.requestEmbedUpdate = true;
          },
        },
      },
      {
        name: t("EMBED_HEIGHT_NAME"),
        desc: fragWithHTML(t("EMBED_HEIGHT_DESC")),
        aliases: ["default embed height", "transcluded image height"],
        control: {
          type: "text",
          key: "height",
          placeholder: "400",
          afterUpdate: () => {
            this.requestEmbedUpdate = true;
          },
        },
      },
      {
        name: t("EXPORT_PNG_SCALE_NAME"),
        desc: t("EXPORT_PNG_SCALE_DESC"),
        aliases: ["PNG scale", "PNG resolution"],
        control: {
          type: "slider",
          key: "pngExportScale",
          min: 1,
          max: 5,
          step: 0.5,
        },
      },
      {
        name: t("EXPORT_PADDING_NAME"),
        desc: fragWithHTML(t("EXPORT_PADDING_DESC")),
        aliases: ["image padding", "export margin", "cropped edge"],
        control: {
          type: "slider",
          key: "exportPaddingSVG",
          min: 0,
          max: 50,
          step: 5,
        },
      },
    ];
  }

  private getExportThemeSpecs(): SettingSpec[] {
    return [
      {
        name: t("EXPORT_BACKGROUND_NAME"),
        desc: fragWithHTML(t("EXPORT_BACKGROUND_DESC")),
        aliases: ["transparent background", "export background"],
        control: {
          type: "toggle",
          key: "exportWithBackground",
          afterUpdate: () => {
            this.requestEmbedUpdate = true;
          },
        },
      },
      {
        name: t("EXPORT_THEME_NAME"),
        desc: fragWithHTML(t("EXPORT_THEME_DESC")),
        aliases: ["export theme", "light export", "dark export"],
        control: {
          type: "toggle",
          key: "exportWithTheme",
          afterUpdate: () => {
            this.requestEmbedUpdate = true;
          },
        },
      },
      {
        name: t("PREVIEW_MATCH_OBSIDIAN_NAME"),
        desc: fragWithHTML(t("PREVIEW_MATCH_OBSIDIAN_DESC")),
        aliases: ["preview theme", "Obsidian theme", "dark mode preview"],
        control: { type: "toggle", key: "previewMatchObsidianTheme" },
      },
    ];
  }

  private renderPdfExportSettings(container: HTMLElement): void {
    new PDFExportSettingsComponent(
      container,
      this.plugin.settings.pdfSettings,
      () => this.applySettingsUpdate(),
    ).render();
  }

  private createPdfExportSettingsDefinition(): SettingDefinition<SettingBindingKey> {
    return this.createRenderedDefinition({
      name: t("PDF_EXPORT_DEFAULTS_CONTROL_NAME"),
      desc: t("PDF_EXPORT_SETTINGS_DESC"),
      aliases: [
        t("EXPORTDIALOG_PAGE_SIZE"),
        t("EXPORTDIALOG_PAGE_ORIENTATION"),
        t("EXPORTDIALOG_PDF_FIT_TO_PAGE"),
        t("EXPORTDIALOG_PDF_MARGIN"),
        t("EXPORTDIALOG_PDF_PAPER_COLOR"),
        t("EXPORTDIALOG_PDF_ALIGNMENT"),
      ],
      controlType: "PDF export settings",
      render: (container) => this.renderPdfExportSettings(container),
    });
  }

  private updateEmbedTypeOption(
    embedType: "PNG" | "SVG",
    enabled: boolean,
    renderState: SettingsRenderState,
  ): void {
    const dropdown = renderState.embedTypeDropdown;
    if (!dropdown?.selectEl.isConnected) {
      return;
    }
    const option = Array.from(dropdown.selectEl.options).find(
      (candidate) => candidate.value === embedType,
    );
    if (enabled && !option) {
      dropdown.addOption(embedType, embedType);
    } else if (!enabled && option) {
      option.remove();
    }
    dropdown.setValue(this.plugin.settings.embedType);
  }

  private setAutoExportEnabled(
    embedType: "PNG" | "SVG",
    enabled: boolean,
    renderState: SettingsRenderState,
  ): void {
    if (embedType === "PNG") {
      this.plugin.settings.autoexportPNG = enabled;
    } else {
      this.plugin.settings.autoexportSVG = enabled;
    }
    if (!enabled && this.plugin.settings.embedType === embedType) {
      this.plugin.settings.embedType = "excalidraw";
    }
    this.updateEmbedTypeOption(embedType, enabled, renderState);
    this.updateEmbedCommentVisibility(renderState);
    this.refreshDeclarativeDomState();
    this.applySettingsUpdate();
  }

  private configureAutoExportSetting(
    setting: Setting,
    embedType: "PNG" | "SVG",
    renderState: SettingsRenderState,
  ): void {
    const isPng = embedType === "PNG";
    setting
      .setName(t(isPng ? "EXPORT_PNG_NAME" : "EXPORT_SVG_NAME"))
      .setDesc(fragWithHTML(t(isPng ? "EXPORT_PNG_DESC" : "EXPORT_SVG_DESC")))
      .addToggle((toggle) =>
        toggle
          .setValue(
            isPng
              ? this.plugin.settings.autoexportPNG
              : this.plugin.settings.autoexportSVG,
          )
          .onChange((value) =>
            this.setAutoExportEnabled(embedType, value, renderState),
          ),
      );
  }

  private createAutoExportDefinition(
    embedType: "PNG" | "SVG",
    renderState: SettingsRenderState,
  ): SettingDefinition<SettingBindingKey> {
    const isPng = embedType === "PNG";
    return this.createCustomSettingDefinition({
      name: t(isPng ? "EXPORT_PNG_NAME" : "EXPORT_SVG_NAME"),
      desc: fragWithHTML(t(isPng ? "EXPORT_PNG_DESC" : "EXPORT_SVG_DESC")),
      aliases: [
        `auto-export ${embedType}`,
        `automatic ${embedType}`,
        `export ${embedType} copy`,
      ],
      controlType: "toggle",
      configure: (setting) =>
        this.configureAutoExportSetting(setting, embedType, renderState),
    });
  }

  private getAutoExportDefinitions(
    renderState: SettingsRenderState,
  ): SettingDefinitionItem<SettingBindingKey>[] {
    const specs = this.getAutoExportSpecs();
    return [
      this.createRelatedSettingsPageDefinition({
        key: "auto-export to inserted file type",
        name: t("EMBED_TYPE_NAME"),
        description: t("SETTINGS_RELATED_EMBED_TYPE_DESC"),
        targetTag: NAVIGATION_TAG_EMBED_PREVIEW,
      }),
      this.declarativeSettingsAdapter.toDefinition(specs[0]),
      this.createAutoExportDefinition("SVG", renderState),
      this.createAutoExportDefinition("PNG", renderState),
      this.declarativeSettingsAdapter.toDefinition(specs[1]),
    ];
  }

  private getAutoExportSpecs(): SettingSpec[] {
    return [
      {
        name: t("EXPORT_SYNC_NAME"),
        desc: fragWithHTML(t("EXPORT_SYNC_DESC")),
        aliases: ["keep exported images in sync", "rename exported images"],
        control: { type: "toggle", key: "keepInSync" },
      },
      {
        name: t("EXPORT_BOTH_DARK_AND_LIGHT_NAME"),
        desc: fragWithHTML(t("EXPORT_BOTH_DARK_AND_LIGHT_DESC")),
        aliases: ["light and dark export", "both themes"],
        control: { type: "toggle", key: "autoExportLightAndDark" },
      },
    ];
  }

  private renderAutoExportSettings(
    container: HTMLElement,
    renderState: SettingsRenderState,
  ): void {
    const specs = this.getAutoExportSpecs();
    this.buildSetting(container, specs[0]);
    this.configureAutoExportSetting(
      new Setting(container),
      "SVG",
      renderState,
    );
    this.configureAutoExportSetting(
      new Setting(container),
      "PNG",
      renderState,
    );
    this.buildSetting(container, specs[1]);
  }

  private getPdfImportSpecs(): SettingSpec[] {
    return [
      {
        name: t("PDF_TO_IMAGE_SCALE_NAME"),
        desc: fragWithHTML(t("PDF_TO_IMAGE_SCALE_DESC")),
        aliases: ["PDF image resolution", "PDF page scale", "PDF import"],
        control: {
          type: "number-dropdown",
          key: "pdfScale",
          options: [0.5, 1, 2, 3, 4, 5, 6].map((value) => ({
            value,
            label: value.toString(),
          })),
        },
      },
    ];
  }

  private renderPdfImportSettings(container: HTMLElement): void {
    addYouTubeThumbnail(container, "nB4cOfn0xAs");
    this.renderSettingSpecs(container, this.getPdfImportSpecs());
  }

  private getEmbeddableMarkdownSpecs(): SettingSpec[] {
    return [
      {
        name: t("MD_EMBED_SINGLECLICK_EDIT_NAME"),
        desc: fragWithHTML(t("MD_EMBED_SINGLECLICK_EDIT_DESC")),
        aliases: ["single click markdown", "edit embeddable"],
        control: { type: "toggle", key: "markdownNodeOneClickEditing" },
      },
    ];
  }

  private renderEmbeddableMarkdownDefaults(container: HTMLElement): void {
    this.renderSettingSpecs(container, this.getEmbeddableMarkdownSpecs());
    this.renderEmbeddableMarkdownDefaultsControl(container);
  }

  private renderEmbeddableMarkdownDefaultsControl(
    container: HTMLElement,
  ): void {
    container.createSpan({}, (element) => {
      setSanitizedHtml(element, t("MD_EMBED_CUSTOMDATA_HEAD_DESC"));
    });
    new EmbeddalbeMDFileCustomDataSettingsComponent(
      container,
      this.plugin.settings.embeddableMarkdownDefaults,
      (requestReloadDrawings?: boolean) =>
        this.applySettingsUpdate(requestReloadDrawings),
    ).render();
  }

  private createEmbeddableMarkdownDefaultsDefinition(): SettingDefinition<SettingBindingKey> {
    return this.createRenderedDefinition({
      name: t("MD_EMBED_DEFAULTS_CONTROL_NAME"),
      desc: fragWithHTML(t("MD_EMBED_CUSTOMDATA_HEAD_DESC")),
      aliases: [
        t("ES_USE_OBSIDIAN_DEFAULTS"),
        t("ES_FILENAME_VISIBLE"),
        t("ES_PROPERTIES_VISIBLE_HEAD"),
        t("ES_LOCKED_READING_MODE_HEAD"),
        t("ES_BACKGROUND_MATCH_ELEMENT"),
        t("ES_BACKGROUND_MATCH_CANVAS"),
        t("ES_BACKGROUND_COLOR"),
        t("ES_BACKGROUND_OPACITY"),
        t("ES_BORDER_MATCH_ELEMENT"),
        t("ES_BORDER_COLOR"),
        t("ES_BORDER_OPACITY"),
      ],
      controlType: "Markdown embeddable defaults",
      render: (container) =>
        this.renderEmbeddableMarkdownDefaultsControl(container),
    });
  }

  private getEmbeddableMarkdownDefaultsDefinitions(): SettingDefinitionItem<SettingBindingKey>[] {
    return [
      ...this.toDeclarativeDefinitions(this.getEmbeddableMarkdownSpecs()),
      this.createEmbeddableMarkdownDefaultsDefinition(),
    ];
  }

  private createMarkdownDimensionDefinition(options: {
    name: string;
    desc: string | DocumentFragment;
    aliases: string[];
    key: "mdSVGwidth" | "mdSVGmaxHeight";
    emptyValue: number;
    placeholder: string;
  }): SettingDefinition<SettingBindingKey> {
    return this.createCustomSettingDefinition({
      name: options.name,
      desc: options.desc,
      aliases: options.aliases,
      controlType: "number input",
      configure: (setting) =>
        this.configureIntegerTextSetting(setting, options),
    });
  }

  private configureMarkdownFontSetting(setting: Setting): () => void {
    setting
      .setName(t("MD_DEFAULT_FONT_NAME"))
      .setDesc(fragWithHTML(t("MD_DEFAULT_FONT_DESC")));
    return this.trackFontPicker(
      new FontPickerComponent(
        setting.controlEl,
        this.app,
        () =>
          getSelectableFontOptions(
            this.app,
            this.plugin.settings.fontAssetsPath,
          ),
        (fontFamily) => this.getBuiltInMarkdownFontCss(fontFamily),
      )
        .setAriaLabel(t("MD_DEFAULT_FONT_NAME"))
        .setValue(this.plugin.settings.mdFont)
        .onChange((value) => {
          this.requestReloadDrawings = true;
          this.plugin.settings.mdFont = value;
          this.applySettingsUpdate(true);
        }),
    );
  }

  private createMarkdownFontDefinition(): SettingDefinition<SettingBindingKey> {
    return this.createCustomSettingDefinition({
      name: t("MD_DEFAULT_FONT_NAME"),
      desc: fragWithHTML(t("MD_DEFAULT_FONT_DESC")),
      aliases: ["Markdown image font", "embedded Markdown typeface"],
      controlType: "font picker",
      configure: (setting) => this.configureMarkdownFontSetting(setting),
    });
  }

  private getMarkdownImageStyleSpecs(): SettingSpec[] {
    return [
      {
        name: t("MD_DEFAULT_COLOR_NAME"),
        desc: fragWithHTML(t("MD_DEFAULT_COLOR_DESC")),
        aliases: ["Markdown embed font color", "text color"],
        control: {
          type: "text",
          key: "mdFontColor",
          placeholder: t("DEFAULT_COLOR_MD_DESC"),
          before: () => {
            this.requestReloadDrawings = true;
          },
          reload: true,
        },
      },
      {
        name: t("MD_DEFAULT_BORDER_COLOR_NAME"),
        desc: fragWithHTML(t("MD_DEFAULT_BORDER_COLOR_DESC")),
        aliases: ["Markdown embed border", "border color"],
        control: {
          type: "text",
          key: "mdBorderColor",
          placeholder: t("DEFAULT_COLOR_MD_DESC"),
          before: () => {
            this.requestReloadDrawings = true;
          },
          reload: true,
        },
      },
      {
        name: t("MD_CSS_NAME"),
        desc: fragWithHTML(t("MD_CSS_DESC")),
        aliases: ["Markdown embed CSS", "CSS snippet", "CSS file"],
        control: {
          type: "text",
          key: "mdCSS",
          placeholder: t("MD_CSS_PLACEHOLDER"),
          before: () => {
            this.requestReloadDrawings = true;
          },
          reload: true,
        },
      },
    ];
  }

  private getMarkdownImageDefaultDefinitions(): SettingDefinitionItem<SettingBindingKey>[] {
    return [
      this.createMarkdownDimensionDefinition({
        name: t("MD_TRANSCLUDE_WIDTH_NAME"),
        desc: fragWithHTML(t("MD_TRANSCLUDE_WIDTH_DESC")),
        aliases: ["Markdown embed width", "transclusion width"],
        key: "mdSVGwidth",
        emptyValue: 500,
        placeholder: "Enter a number e.g. 500",
      }),
      this.createMarkdownDimensionDefinition({
        name: t("MD_TRANSCLUDE_HEIGHT_NAME"),
        desc: fragWithHTML(t("MD_TRANSCLUDE_HEIGHT_DESC")),
        aliases: ["Markdown embed height", "transclusion maximum height"],
        key: "mdSVGmaxHeight",
        emptyValue: 800,
        placeholder: "Enter a number e.g. 800",
      }),
      this.createMarkdownFontDefinition(),
      ...this.toDeclarativeDefinitions(this.getMarkdownImageStyleSpecs()),
    ];
  }

  private renderMarkdownImageDefaultSettings(container: HTMLElement): void {
    this.configureIntegerTextSetting(new Setting(container), {
      name: t("MD_TRANSCLUDE_WIDTH_NAME"),
      desc: fragWithHTML(t("MD_TRANSCLUDE_WIDTH_DESC")),
      key: "mdSVGwidth",
      emptyValue: 500,
      placeholder: "Enter a number e.g. 500",
    });
    this.configureIntegerTextSetting(new Setting(container), {
      name: t("MD_TRANSCLUDE_HEIGHT_NAME"),
      desc: fragWithHTML(t("MD_TRANSCLUDE_HEIGHT_DESC")),
      key: "mdSVGmaxHeight",
      emptyValue: 800,
      placeholder: "Enter a number e.g. 800",
    });
    this.configureMarkdownFontSetting(new Setting(container));
    this.renderSettingSpecs(container, this.getMarkdownImageStyleSpecs());
  }

  private getNonstandardSpecs(): SettingSpec[] {
    return [
      {
        name: t("MAX_IMAGE_ZOOM_IN_NAME"),
        desc: fragWithHTML(t("MAX_IMAGE_ZOOM_IN_DESC")),
        aliases: ["image zoom resolution", "rendering multiplier"],
        control: {
          type: "slider",
          key: "areaZoomLimit",
          min: 1,
          max: 10,
          step: 0.5,
          afterUpdate: () =>
            this.plugin.excalidrawConfig.updateValues(this.plugin),
        },
      },
      {
        name: t("CUSTOM_PEN_NAME"),
        desc: t("CUSTOM_PEN_DESC"),
        aliases: ["custom pens", "pinned pens", "pen buttons"],
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
      },
    ];
  }

  private getNonstandardDefinitions(): SettingDefinitionItem<SettingBindingKey>[] {
    const specs = this.getNonstandardSpecs();
    return [
      this.declarativeSettingsAdapter.toDefinition(specs[0]),
      this.createYouTubeDefinition(t("CUSTOM_PEN_HEAD"), "OjNhjaH2KjI", 69),
      this.declarativeSettingsAdapter.toDefinition(specs[1]),
    ];
  }

  private renderNonstandardSettings(container: HTMLElement): void {
    const specs = this.getNonstandardSpecs();
    this.buildSetting(container, specs[0]);
    addYouTubeThumbnail(container, "OjNhjaH2KjI", 69);
    this.buildSetting(container, specs[1]);
  }

  private getLocalFontSpecs(): SettingSpec[] {
    return [
      {
        name: t("ENABLE_FOURTH_FONT_NAME"),
        desc: fragWithHTML(t("ENABLE_FOURTH_FONT_DESC")),
        aliases: ["fourth font", "local font option", "custom typeface"],
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
      },
    ];
  }

  private configureFourthFontSetting(setting: Setting): () => void {
    setting
      .setName(t("FOURTH_FONT_NAME"))
      .setDesc(fragWithHTML(t("FOURTH_FONT_DESC")));
    return this.trackFontPicker(
      new FontPickerComponent(
        setting.controlEl,
        this.app,
        () =>
          getSelectableFontOptions(
            this.app,
            this.plugin.settings.fontAssetsPath,
            ["Virgil"],
          ),
        (fontFamily) => this.getBuiltInMarkdownFontCss(fontFamily),
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
  }

  private getLocalFontDefinitions(): SettingDefinitionItem<SettingBindingKey>[] {
    return [
      this.createYouTubeDefinition(t("CUSTOM_FONT_HEAD"), "eKFmrSQhFA4"),
      ...this.toDeclarativeDefinitions(this.getLocalFontSpecs()),
      this.createCustomSettingDefinition({
        name: t("FOURTH_FONT_NAME"),
        desc: fragWithHTML(t("FOURTH_FONT_DESC")),
        aliases: ["fourth font file", "custom font file", "vault font"],
        controlType: "font picker",
        configure: (setting) => this.configureFourthFontSetting(setting),
      }),
    ];
  }

  private renderLocalFontSettings(container: HTMLElement): void {
    addYouTubeThumbnail(container, "eKFmrSQhFA4");
    this.renderSettingSpecs(container, this.getLocalFontSpecs());
    this.configureFourthFontSetting(new Setting(container));
  }

  private getOfflineCjkSpecs(): SettingSpec[] {
    return [
      {
        name: t("CJK_ASSETS_FOLDER_NAME"),
        desc: fragWithHTML(t("CJK_ASSETS_FOLDER_DESC")),
        aliases: ["CJK fonts folder", "offline fonts", "font assets"],
        control: {
          type: "text",
          key: "fontAssetsPath",
          placeholder: t("CJK_ASSETS_FOLDER_PLACEHOLDER"),
          vaultPath: { kind: "folder", options: { optional: true } },
        },
      },
      {
        name: t("LOAD_CHINESE_FONTS_NAME"),
        aliases: ["Chinese font", "CJK startup"],
        control: { type: "toggle", key: "loadChineseFonts" },
      },
      {
        name: t("LOAD_JAPANESE_FONTS_NAME"),
        aliases: ["Japanese font", "CJK startup"],
        control: { type: "toggle", key: "loadJapaneseFonts" },
      },
      {
        name: t("LOAD_KOREAN_FONTS_NAME"),
        aliases: ["Korean font", "CJK startup"],
        control: { type: "toggle", key: "loadKoreanFonts" },
      },
    ];
  }

  private createOfflineCjkInformationDefinition(): SettingDefinition<SettingBindingKey> {
    return this.createRenderedDefinition({
      name: `${t("OFFLINE_CJK_NAME")} · instructions`,
      searchable: false,
      omitFromMarkdown: true,
      render: (container) => {
        const description = container.createDiv({
          cls: "setting-item-description",
        });
        setSanitizedHtml(description, t("OFFLINE_CJK_DESC"));
      },
    });
  }

  private getOfflineCjkDefinitions(): SettingDefinitionItem<SettingBindingKey>[] {
    return [
      this.createOfflineCjkInformationDefinition(),
      ...this.toDeclarativeDefinitions(this.getOfflineCjkSpecs()),
    ];
  }

  private renderOfflineCjkSettings(container: HTMLElement): void {
    const description = container.createDiv({
      cls: "setting-item-description",
    });
    setSanitizedHtml(description, t("OFFLINE_CJK_DESC"));
    this.renderSettingSpecs(container, this.getOfflineCjkSpecs());
  }

  private getExperimentalSpecs(): SettingSpec[] {
    return [
      {
        name: t("LATEX_DEFAULT_NAME"),
        desc: fragWithHTML(t("LATEX_DEFAULT_DESC")),
        aliases: ["LaTeX boilerplate", "default formula"],
        control: { type: "text", key: "latexBoilerplate" },
      },
      {
        name: t("LATEX_PREAMBLE_NAME"),
        desc: fragWithHTML(t("LATEX_PREAMBLE_DESC")),
        aliases: ["LaTeX preamble", "sty file"],
        control: {
          type: "text",
          key: "latexPreambleLocation",
          placeholder: "e.g.: preamble.sty",
          vaultPath: {
            kind: "file",
            options: { optional: true, extensions: ["sty"] },
          },
        },
      },
      {
        name: t("FILETYPE_NAME"),
        desc: fragWithHTML(t("FILETYPE_DESC")),
        aliases: ["file type indicator", "drawing icon"],
        control: {
          type: "toggle",
          key: "experimentalFileType",
          after: (value) =>
            this.plugin.experimentalFileTypeDisplayToggle(value),
        },
      },
      {
        name: t("FILETAG_NAME"),
        desc: fragWithHTML(t("FILETAG_DESC")),
        aliases: ["file tag", "drawing emoji", "type indicator"],
        control: {
          type: "text",
          key: "experimentalFileTag",
          placeholder: t("INSERT_EMOJI"),
        },
      },
      {
        name: t("LIVEPREVIEW_NAME"),
        desc: fragWithHTML(t("LIVEPREVIEW_DESC")),
        aliases: ["live preview image", "immersive embed"],
        control: { type: "toggle", key: "experimentalLivePreview" },
      },
      {
        name: t("FADE_OUT_EXCALIDRAW_MARKUP_NAME"),
        desc: fragWithHTML(t("FADE_OUT_EXCALIDRAW_MARKUP_DESC")),
        aliases: ["hide drawing markup", "markdown fade"],
        control: {
          type: "toggle",
          key: "fadeOutExcalidrawMarkup",
          after: (value) =>
            this.plugin.editorHandler.updateCMExtensionState(
              EDITOR_FADEOUT,
              value,
            ),
        },
      },
      {
        name: t("EXCALIDRAW_PROPERTIES_NAME"),
        desc: fragWithHTML(t("EXCALIDRAW_PROPERTIES_DESC")),
        aliases: ["property suggestions", "frontmatter properties"],
        control: { type: "toggle", key: "loadPropertySuggestions" },
      },
    ];
  }

  private getExperimentalDefinitions(): SettingDefinitionItem<SettingBindingKey>[] {
    return [
      this.createYouTubeDefinition(t("EXPERIMENTAL_HEAD"), "r08wk-58DPk"),
      ...this.toDeclarativeDefinitions(this.getExperimentalSpecs()),
    ];
  }

  private renderExperimentalSettings(container: HTMLElement): void {
    addYouTubeThumbnail(container, "r08wk-58DPk");
    this.renderSettingSpecs(container, this.getExperimentalSpecs());
  }

  private getTaskboneDefinitions(): SettingDefinitionItem<SettingBindingKey>[] {
    return [
      this.createRenderedDefinition({
        name: `${t("TASKBONE_HEAD")} · information`,
        searchable: false,
        omitFromMarkdown: true,
        render: (container) => {
          container.createDiv({
            text: t("TASKBONE_DESC"),
            cls: "setting-item-description",
          });
        },
      }),
      this.createYouTubeDefinition(t("TASKBONE_HEAD"), "7gu4ETx7zro"),
      this.createRenderedDefinition({
        name: `${t("TASKBONE_HEAD")} · settings`,
        aliases: [
          t("TASKBONE_ENABLE_NAME"),
          t("TASKBONE_APIKEY_NAME"),
          "OCR API key",
        ],
        controlType: "Taskbone settings",
        render: (container) => this.renderTaskboneControls(container),
      }),
    ];
  }

  private renderTaskboneSettings(container: HTMLElement): void {
    container.createDiv({
      text: t("TASKBONE_DESC"),
      cls: "setting-item-description",
    });
    addYouTubeThumbnail(container, "7gu4ETx7zro");
    this.renderTaskboneControls(container);
  }

  private renderTaskboneControls(container: HTMLElement): void {
    let taskboneAPIKeyText: TextComponent;
    this.buildSetting(container, {
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
    this.buildSetting(container, {
      name: t("TASKBONE_APIKEY_NAME"),
      desc: fragWithHTML(t("TASKBONE_APIKEY_DESC")),
      control: {
        type: "text",
        key: "taskboneAPIkey",
        disabled: () => !this.plugin.settings.taskboneEnabled,
        capture: (text) => {
          taskboneAPIKeyText = text;
          configurePasswordTextInput(text);
        },
      },
    });
  }

  private getAutomateSpecs(): SettingSpec[] {
    return [
      {
        name: t("FIELD_SUGGESTER_NAME"),
        desc: fragWithHTML(t("FIELD_SUGGESTER_DESC")),
        aliases: ["Excalidraw Automate autocomplete", "EA suggester"],
        control: { type: "toggle", key: "fieldSuggester" },
      },
      {
        name: t("ENABLE_ONLOAD_SCRIPTS_NAME"),
        desc: fragWithHTML(t("ENABLE_ONLOAD_SCRIPTS_DESC")),
        aliases: ["drawing onload script", "file script"],
        control: { type: "toggle", key: "enableOnloadScripts" },
      },
      {
        name: t("ENABLE_COMMAND_LINKS_NAME"),
        desc: fragWithHTML(t("ENABLE_COMMAND_LINKS_DESC")),
        aliases: ["cmd links", "command URL"],
        control: { type: "toggle", key: "enableCommandLinks" },
      },
    ];
  }

  private createAutomateInformationDefinition(): SettingDefinition<SettingBindingKey> {
    return this.createRenderedDefinition({
      name: `${t("EA_HEAD")} · documentation`,
      searchable: false,
      omitFromMarkdown: true,
      render: (container) => {
        const description = container.createDiv({
          cls: "setting-item-description",
        });
        setSanitizedHtml(description, t("EA_DESC"));
      },
    });
  }

  private createStartupScriptDefinition(): SettingDefinition<SettingBindingKey> {
    return this.createCustomSettingDefinition({
      name: t("STARTUP_SCRIPT_NAME"),
      desc: fragWithHTML(t("STARTUP_SCRIPT_DESC")),
      aliases: ["plugin startup automation", "startup markdown script"],
      controlType: "file input and icon button",
      configure: (setting) => this.configureStartupScriptSetting(setting),
    });
  }

  private createAutostartScriptsDefinition(): SettingDefinition<SettingBindingKey> {
    return this.createRenderedDefinition({
      name: t("AUTOSTART_SCRIPTS_HEAD"),
      desc: t("AUTOSTART_SCRIPTS_DESC"),
      aliases: ["automatic scripts", "script permissions"],
      controlType: "script permission table",
      render: (container) => {
        new AutostartScriptsSettingsComponent(container, this.plugin).render();
      },
    });
  }

  private getAutomateDefinitions(): SettingDefinitionItem<SettingBindingKey>[] {
    return [
      this.createAutomateInformationDefinition(),
      ...this.toDeclarativeDefinitions(this.getAutomateSpecs()),
      this.createStartupScriptDefinition(),
      this.createAutostartScriptsDefinition(),
    ];
  }

  private renderAutomateSettings(container: HTMLElement): void {
    const description = container.createDiv({ cls: "setting-item-description" });
    setSanitizedHtml(description, t("EA_DESC"));
    this.renderSettingSpecs(container, this.getAutomateSpecs());
    this.configureStartupScriptSetting(new Setting(container));
    new AutostartScriptsSettingsComponent(
      container.createDiv(),
      this.plugin,
    ).render();
  }

  private configureStartupScriptSetting(setting: Setting): void {
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
    const updateStartupScriptButton = (button: ButtonComponent): void => {
      const exists = scriptExists();
      button
        .setIcon(exists ? "file-code-2" : "file-plus-2")
        .setTooltip(
          exists
            ? t("STARTUP_SCRIPT_BUTTON_OPEN")
            : t("STARTUP_SCRIPT_BUTTON_CREATE"),
        );
    };
    setting
      .setName(t("STARTUP_SCRIPT_NAME"))
      .setDesc(fragWithHTML(t("STARTUP_SCRIPT_DESC")))
      .addText((text) => {
        startupScriptPathText = text;
        text
          .setValue(this.plugin.settings.startupScriptPath)
          .onChange((value) => {
            this.plugin.settings.startupScriptPath = value;
            updateStartupScriptButton(startupScriptButton);
            this.applySettingsUpdate();
          });
        this.addVaultPathSupport(setting, text, "file", {
          optional: true,
          extensions: ["md"],
          resolvePath: (value) =>
            value && !value.endsWith(".md") ? `${value}.md` : value,
        });
      })
      .addButton((button) => {
        startupScriptButton = button;
        updateStartupScriptButton(button);
        button.onClick(async () => {
          if (this.plugin.settings.startupScriptPath === "") {
            this.plugin.settings.startupScriptPath = normalizePath(
              `${normalizePath(this.plugin.settings.folder)}/ExcalidrawStartup`,
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
          let file = this.app.vault.getAbstractFileByPath(startupPath);
          if (!file) {
            file = await createOrOverwriteFile(
              this.app,
              startupPath,
              startupScript(),
            );
          }
          updateStartupScriptButton(button);
          await this.app.workspace.openLinkText(file.path, "", true);
          this.hide();
        });
      });
  }

  private getInstalledScriptNames(): string[] {
    const { scriptEngine } = this.plugin;
    const configured = Object.keys(this.plugin.settings.scriptEngineSettings);
    // Obsidian can index declarative definitions before layout-ready creates
    // ScriptEngine. Preserve discoverability during that early pass; once the
    // engine exists, continue hiding settings for scripts no longer installed.
    if (!scriptEngine) {
      return configured;
    }
    const installed =
      scriptEngine
        ?.getListofScripts()
        ?.map((file) => scriptEngine.getScriptName(file)) ?? [];
    return configured.filter((scriptName) => installed.includes(scriptName));
  }

  private isVisibleScriptSetting(value: unknown): boolean {
    return !(
      typeof value === "object" &&
      value !== null &&
      (value as ScriptSettingValue).hidden
    );
  }

  private hasInstalledScriptSettings(): boolean {
    return this.getInstalledScriptNames().some((scriptName) =>
      Object.values(
        this.plugin.settings.scriptEngineSettings[scriptName],
      ).some((value) => this.isVisibleScriptSetting(value)),
    );
  }

  private getInstalledScriptDefinitions(): SettingDefinitionItem<SettingBindingKey>[] {
    const aliases = Object.entries(
      this.plugin.settings.scriptEngineSettings,
    ).flatMap(([scriptName, settings]) => [
      scriptName,
      ...Object.keys(settings),
    ]);
    return [
      this.createYouTubeDefinition(t("SCRIPT_SETTINGS_HEAD"), "H8Njp7ZXYag", 52),
      this.createRenderedDefinition({
        name: `${t("SCRIPT_SETTINGS_HEAD")} · controls`,
        aliases,
        controlType: "installed script settings",
        render: (container) => this.renderInstalledScriptControls(container),
      }),
    ];
  }

  private renderInstalledScriptSettings(container: HTMLElement): void {
    addYouTubeThumbnail(container, "H8Njp7ZXYag", 52);
    this.renderInstalledScriptControls(container);
  }

  private renderInstalledScriptControls(container: HTMLElement): void {
    const getValue = (scriptName: string, variableName: string) => {
      const variable =
        this.plugin.settings.scriptEngineSettings[scriptName][variableName];
      return typeof variable === "object" && variable !== null
        ? variable.value
        : variable;
    };
    const setValue = (
      scriptName: string,
      variableName: string,
      value: string | number | boolean,
    ) => {
      const current =
        this.plugin.settings.scriptEngineSettings[scriptName][variableName];
      if (typeof current === "object" && current !== null) {
        current.value = value;
      } else {
        this.plugin.settings.scriptEngineSettings[scriptName][variableName] =
          value;
      }
      this.applySettingsUpdate();
    };

    this.getInstalledScriptNames().forEach((scriptName) => {
      const settings = this.plugin.settings.scriptEngineSettings[scriptName];
      const visibleEntries = Object.entries(settings).filter(([, value]) =>
        this.isVisibleScriptSetting(value),
      );
      if (visibleEntries.length === 0) {
        return;
      }
      const scriptDetails = container.createEl("details");
      scriptDetails.createEl("summary", {
        text: scriptName,
        cls: "excalidraw-setting-h3",
      });
      visibleEntries.forEach(([variableName, variable]) => {
        const metadata =
          typeof variable === "object" && variable !== null ? variable : null;
        const value = metadata?.value ?? variable;
        const setting = new Setting(scriptDetails)
          .setName(variableName)
          .setDesc(fragWithHTML(metadata?.description ?? ""));
        if (typeof value === "boolean") {
          setting.addToggle((toggle) =>
            toggle
              .setValue(value)
              .onChange((next) => setValue(scriptName, variableName, next)),
          );
        } else if (typeof value === "string" && metadata?.valueset?.length) {
          setting.addDropdown((dropdown) => {
            metadata.valueset?.forEach((option) => {
              void dropdown.addOption(option, option);
            });
            dropdown
              .setValue(value)
              .onChange((next) => setValue(scriptName, variableName, next));
          });
        } else if (typeof value === "string" && metadata?.height) {
          setting.addTextArea((text) => {
            setStyle(text.inputEl, {
              minHeight: `${metadata.height}px`,
              minWidth: "400px",
              width: "100%",
            });
            text
              .setValue(value)
              .onChange((next) => setValue(scriptName, variableName, next));
          });
        } else if (typeof value === "string") {
          setting.addText((text) =>
            text
              .setValue(value)
              .onChange((next) => setValue(scriptName, variableName, next)),
          );
        } else if (typeof value === "number") {
          setting.addText((text) =>
            text
              .setPlaceholder("Enter a number")
              .setValue(value.toString())
              .onChange((next) => {
                const parsed = parseFloat(next);
                if (Number.isNaN(parsed) && next !== "") {
                  const current = getValue(scriptName, variableName);
                  text.setValue(
                    typeof current === "number" ? current.toString() : "",
                  );
                  return;
                }
                setValue(
                  scriptName,
                  variableName,
                  Number.isNaN(parsed) ? 0 : parsed,
                );
              }),
          );
        }
      });
    });
  }

  private getCompatibilitySpecs(
    renderState: SettingsRenderState,
  ): SettingSpec[] {
    return [
      {
        name: t("DUMMY_TEXT_ELEMENT_LINT_SUPPORT_NAME"),
        desc: fragWithHTML(t("DUMMY_TEXT_ELEMENT_LINT_SUPPORT_DESC")),
        aliases: ["lint support", "dummy text element"],
        control: { type: "toggle", key: "addDummyTextElement" },
      },
      {
        name: t("PRESERVE_TEXT_AFTER_DRAWING_NAME"),
        desc: fragWithHTML(t("PRESERVE_TEXT_AFTER_DRAWING_DESC")),
        aliases: ["Zotero compatibility", "preserve markdown text"],
        control: { type: "toggle", key: "zoteroCompatibility" },
      },
      {
        name: t("SLIDING_PANES_NAME"),
        desc: fragWithHTML(t("SLIDING_PANES_DESC")),
        aliases: ["sliding panes", "Andy mode"],
        control: { type: "toggle", key: "slidingPanesSupport" },
      },
      {
        name: t("COMPATIBILITY_MODE_NAME"),
        desc: fragWithHTML(t("COMPATIBILITY_MODE_DESC")),
        aliases: ["legacy Excalidraw file", "filename compatibility"],
        control: {
          type: "toggle",
          key: "compatibilityMode",
          after: () => this.refreshFilenameSample(renderState),
        },
      },
      {
        name: t("EXPORT_EXCALIDRAW_NAME"),
        desc: fragWithHTML(t("EXPORT_EXCALIDRAW_DESC")),
        aliases: ["export excalidraw file", "excalidraw.com compatibility"],
        control: { type: "toggle", key: "autoexportExcalidraw" },
      },
      {
        name: t("SYNC_EXCALIDRAW_NAME"),
        desc: fragWithHTML(t("SYNC_EXCALIDRAW_DESC")),
        aliases: ["sync Excalidraw file", "two-way compatibility"],
        control: { type: "toggle", key: "syncExcalidraw" },
      },
    ];
  }
}
