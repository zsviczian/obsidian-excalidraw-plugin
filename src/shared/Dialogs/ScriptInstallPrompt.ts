import {
  Modal,
  Notice,
  normalizePath,
  request,
  setIcon,
} from "obsidian";
import { SCRIPT_INSTALL_FOLDER } from "../../constants/constants";
import {
  getPluginRepositoryBlobUrl,
  getPluginRepositoryRawUrl,
  URLs,
} from "../../constants/safeUrls";
import { t } from "../../lang/helpers";
import type {
  ScriptStoreCatalog,
  ScriptStoreEntry,
  ScriptStoreInstallState,
} from "../../types/scriptStoreTypes";
import { sanitizedFragment, setSanitizedHtml } from "../../utils/htmlUtils";
import {
  getInstalledScriptFiles,
  getInstalledScriptGroups,
  getScriptInstallStates,
  installScript,
  moveInstalledScriptToGroup,
  uninstallScript,
  type ScriptLibraryPluginContext,
} from "../../utils/scriptLibraryUtils";
import { errorlog } from "../../utils/utils";

const CATALOG_URL =
  URLs.RAW_GITHUBUSERCONTENT_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_MASTER_EA_SCRIPTS_SCRIPT_STORE_JSON;
const FEATURED_CATEGORY = "Editors Picks";

type StoreView = "all" | "installed";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isUnknownArray = (value: unknown): value is unknown[] =>
  Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  isUnknownArray(value) &&
  value.every((item: unknown) => typeof item === "string");

const isScriptStoreEntry = (value: unknown): value is ScriptStoreEntry =>
  isRecord(value) &&
  typeof value.name === "string" &&
  typeof value.file === "string" &&
  typeof value.installUrl === "string" &&
  typeof value.iconUrl === "string" &&
  typeof value.author === "string" &&
  typeof value.authorUrl === "string" &&
  typeof value.sourceUrl === "string" &&
  typeof value.descriptionHtml === "string" &&
  isStringArray(value.categories) &&
  (value.featuredRank === undefined || typeof value.featuredRank === "number");

const isScriptStoreCategory = (
  value: unknown,
): value is ScriptStoreCatalog["categories"][number] =>
  isRecord(value) &&
  typeof value.name === "string" &&
  typeof value.description === "string";

const parseScriptStoreCatalog = (source: string): ScriptStoreCatalog => {
  const parsed: unknown = JSON.parse(source) as unknown;
  if (
    !isRecord(parsed) ||
    parsed.version !== 1 ||
    !isUnknownArray(parsed.scripts) ||
    !parsed.scripts.every(isScriptStoreEntry) ||
    !isUnknownArray(parsed.categories) ||
    !parsed.categories.every(isScriptStoreCategory)
  ) {
    throw new Error("Unsupported script store catalog");
  }
  return {
    version: parsed.version,
    scripts: parsed.scripts,
    categories: parsed.categories,
  };
};

const getScriptInstallUrl = (entry: ScriptStoreEntry): string =>
  getPluginRepositoryRawUrl(`ea-scripts/${entry.file}`);

const getScriptIconUrl = (entry: ScriptStoreEntry): string =>
  getPluginRepositoryRawUrl(
    `ea-scripts/${entry.file.replace(/\.(?:md|js)$/i, ".svg")}`,
  );

const getScriptSourceUrl = (entry: ScriptStoreEntry): string =>
  getPluginRepositoryBlobUrl(`ea-scripts/${entry.file}`);

export class ScriptInstallPrompt extends Modal {
  private contentDiv: HTMLDivElement;
  private catalog: ScriptStoreCatalog | null = null;
  private installStates = new Map<string, ScriptStoreInstallState>();
  private descriptionText = new Map<string, string>();
  private selectedCategory = "";
  private searchQuery = "";
  private storeView: StoreView = "all";

  constructor(private plugin: ScriptLibraryPluginContext) {
    super(plugin.app);
  }

  onOpen(): void {
    this.titleEl.setText(t("SCRIPT_STORE_TITLE"));
    this.contentEl.classList.add(
      "excalidraw-scriptengine-install",
      "excalidraw-script-store",
    );
    this.containerEl.classList.add(
      "excalidraw-scriptengine-install",
      "excalidraw-script-store",
    );
    this.contentDiv = this.contentEl.createDiv({
      cls: "excalidraw-script-store__content",
    });
    this.renderLoading();
    void this.loadStore();
  }

  private renderLoading(): void {
    this.contentDiv.replaceChildren();
    const loading = this.contentDiv.createDiv({
      cls: "excalidraw-script-store__loading",
    });
    const icon = loading.createSpan({
      cls: "excalidraw-script-store__loading-icon",
    });
    setIcon(icon, "loader-circle");
    loading.createSpan({ text: t("SCRIPT_STORE_LOADING") });
  }

  private async loadStore(): Promise<void> {
    try {
      const source = await request({ url: CATALOG_URL });
      this.catalog = parseScriptStoreCatalog(source);
      await this.refreshInstallStates();
      this.renderStore();
    } catch (error: unknown) {
      errorlog({ where: "ScriptInstallPrompt.loadStore", error });
      new Notice(t("SCRIPT_INSTALL_PROMPT_OPEN_ERROR"));
      this.close();
    }
  }

  private async refreshInstallStates(): Promise<void> {
    if (!this.catalog) {
      return;
    }
    const sources = this.catalog.scripts.map((entry) =>
      getScriptInstallUrl(entry),
    );
    const states = await getScriptInstallStates(this.plugin, sources);
    this.installStates = new Map(
      this.catalog.scripts.map((entry, index) => [
        entry.name,
        states.get(sources[index]) ?? "error",
      ]),
    );
  }

  private renderStore(): void {
    if (!this.catalog) {
      return;
    }
    this.contentDiv.replaceChildren();
    this.renderSupportBar();
    this.renderScriptingBanner();
    this.renderUpdates();
    this.renderBrowseControls();
    this.renderScriptGrid();
  }

  private renderSupportBar(): void {
    const support = this.contentDiv.createDiv({
      cls: "excalidraw-script-store__support-bar",
    });

    const mastery = support.createEl("a", {
      href: URLs.COMMUNITY_SKETCH_YOUR_MIND_COM_EM,
      cls: "excalidraw-script-store__support-item",
      attr: { target: "_blank", rel: "noopener noreferrer" },
    });
    mastery.createEl("img", {
      cls: "excalidraw-script-store__support-logo",
      attr: {
        src: URLs.SKETCH_YOUR_MIND_COM_IMAGES_LOGO_EM_PNG,
        alt: t("SCRIPT_STORE_MASTERY_TITLE"),
        loading: "lazy",
      },
    });
    const masteryText = mastery.createDiv({
      cls: "excalidraw-script-store__support-text",
    });
    masteryText.createEl("strong", { text: t("SCRIPT_STORE_MASTERY_TITLE") });
    masteryText.createSpan({ text: t("SCRIPT_STORE_MASTERY_DESC") });

    const coffee = support.createEl("a", {
      href: URLs.KO_FI_COM_ZSOLT,
      cls: "excalidraw-script-store__support-item",
      attr: { target: "_blank", rel: "noopener noreferrer" },
    });
    const coffeeIcon = coffee.createSpan({
      cls: "excalidraw-script-store__support-icon",
    });
    setIcon(coffeeIcon, "coffee");
    const coffeeText = coffee.createDiv({
      cls: "excalidraw-script-store__support-text",
    });
    coffeeText.createEl("strong", { text: t("SCRIPT_STORE_COFFEE_TITLE") });
    coffeeText.createSpan({ text: t("SCRIPT_STORE_COFFEE_DESC") });
  }

  private renderScriptingBanner(): void {
    const section = this.contentDiv.createDiv({
      cls: "excalidraw-script-store__scripting-promo",
    });
    const link = section.createEl("a", {
      href: URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_BLOB_MASTER_DOCS_EA_SCRIPTING_MD,
      cls: "excalidraw-script-store__scripting-link",
      attr: { target: "_blank", rel: "noopener noreferrer" },
    });
    link.createEl("img", {
      cls: "excalidraw-script-store__scripting-banner",
      attr: {
        src: URLs.RAW_GITHUBUSERCONTENT_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_MASTER_IMAGE_BANNER_AUTOMATE_ANYTHING_PNG,
        alt: t("SCRIPT_STORE_SCRIPTING_BANNER_ALT"),
        loading: "lazy",
      },
    });
    link.createDiv({
      cls: "excalidraw-script-store__scripting-caption",
      text: t("SCRIPT_STORE_SCRIPTING_BANNER_CAPTION"),
    });
  }

  private getUpdates(): ScriptStoreEntry[] {
    return (
      this.catalog?.scripts.filter(
        (entry) => this.installStates.get(entry.name) === "update",
      ) ?? []
    );
  }

  private renderUpdates(): void {
    const updates = this.getUpdates();
    if (updates.length === 0) {
      return;
    }
    const section = this.contentDiv.createDiv({
      cls: "excalidraw-script-store__updates",
    });
    const header = section.createDiv({
      cls: "excalidraw-script-store__updates-header",
    });
    const titleWrap = header.createDiv();
    const title = titleWrap.createEl("h2", {
      text: `${t("SCRIPT_STORE_UPDATES_TITLE")} (${updates.length})`,
    });
    const icon = title.createSpan({
      cls: "excalidraw-script-store__inline-icon",
    });
    setIcon(icon, "circle-arrow-up");
    titleWrap.createEl("p", { text: t("SCRIPT_STORE_UPDATES_DESC") });

    const updateAll = header.createEl("button", {
      text: t("SCRIPT_STORE_UPDATE_ALL"),
      cls: "mod-cta",
      type: "button",
    });
    updateAll.addEventListener("click", () => {
      void this.updateAll(updateAll);
    });

    const list = section.createDiv({
      cls: "excalidraw-script-store__update-list",
    });
    updates.forEach((entry) => {
      const button = list.createEl("button", {
        text: entry.name,
        cls: "excalidraw-script-store__update-chip",
        type: "button",
      });
      button.addEventListener("click", () => this.renderDetail(entry));
    });
  }

  private async updateAll(button: HTMLButtonElement): Promise<void> {
    const updates = this.getUpdates();
    if (updates.length === 0) {
      return;
    }
    button.disabled = true;
    button.setText(t("SCRIPT_STORE_UPDATING"));
    let failures = 0;
    for (const entry of updates) {
      try {
        await installScript(this.plugin, getScriptInstallUrl(entry), false);
        this.installStates.set(entry.name, "up-to-date");
      } catch {
        failures += 1;
        this.installStates.set(entry.name, "error");
      }
    }
    new Notice(
      failures === 0
        ? t("SCRIPT_STORE_UPDATE_ALL_DONE")
        : `${t("SCRIPT_STORE_UPDATE_ALL_PARTIAL")} ${failures}`,
    );
    this.renderStore();
  }

  private renderBrowseControls(): void {
    if (!this.catalog) {
      return;
    }
    const browse = this.contentDiv.createDiv({
      cls: "excalidraw-script-store__browse-header",
    });
    const heading = browse.createDiv();
    heading.createEl("h2", { text: t("SCRIPT_STORE_BROWSE_TITLE") });
    heading.createEl("p", { text: t("SCRIPT_STORE_BROWSE_DESC") });

    const controls = browse.createDiv({
      cls: "excalidraw-script-store__controls",
    });
    const searchWrap = controls.createDiv({
      cls: "excalidraw-script-store__search",
    });
    const searchIcon = searchWrap.createSpan();
    setIcon(searchIcon, "search");
    const search = searchWrap.createEl("input", {
      type: "search",
      placeholder: t("SCRIPT_STORE_SEARCH_PLACEHOLDER"),
      attr: { "aria-label": t("SCRIPT_STORE_SEARCH_PLACEHOLDER") },
    });
    search.value = this.searchQuery;
    search.addEventListener("input", () => {
      this.searchQuery = search.value.trim().toLowerCase();
      this.renderScriptGrid();
    });

    const category = controls.createEl("select", {
      attr: { "aria-label": t("SCRIPT_STORE_CATEGORY_LABEL") },
    });
    category.createEl("option", {
      text: t("SCRIPT_STORE_ALL_CATEGORIES"),
      value: "",
    });
    this.catalog.categories.forEach((item) => {
      category.createEl("option", { text: item.name, value: item.name });
    });
    category.value = this.selectedCategory;
    category.addEventListener("change", () => {
      this.selectedCategory = category.value;
      this.renderScriptGrid();
    });

    const viewToggle = controls.createDiv({
      cls: "excalidraw-script-store__view-toggle",
    });
    this.renderViewButton(viewToggle, "all", t("SCRIPT_STORE_ALL_SCRIPTS"));
    this.renderViewButton(
      viewToggle,
      "installed",
      t("SCRIPT_STORE_INSTALLED_SCRIPTS"),
    );
  }

  private renderViewButton(
    parent: HTMLElement,
    view: StoreView,
    label: string,
  ): void {
    const button = parent.createEl("button", {
      text: label,
      cls: this.storeView === view ? "is-active" : undefined,
      type: "button",
    });
    button.addEventListener("click", () => {
      this.storeView = view;
      parent.querySelectorAll("button").forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });
      this.renderScriptGrid();
    });
  }

  private renderScriptGrid(): void {
    if (!this.catalog) {
      return;
    }
    this.contentDiv.querySelector(".excalidraw-script-store__results")?.remove();
    const results = this.contentDiv.createDiv({
      cls: "excalidraw-script-store__results",
    });
    const entries = this.getFilteredEntries();
    results.createDiv({
      cls: "excalidraw-script-store__result-summary",
      text: `${entries.length} ${t("SCRIPT_STORE_RESULTS")}`,
    });
    if (entries.length === 0) {
      const empty = results.createDiv({
        cls: "excalidraw-script-store__empty",
      });
      const icon = empty.createSpan();
      setIcon(icon, "search-x");
      empty.createEl("h3", { text: t("SCRIPT_STORE_NO_RESULTS") });
      empty.createEl("p", { text: t("SCRIPT_STORE_NO_RESULTS_DESC") });
      return;
    }

    const grid = results.createDiv({ cls: "excalidraw-script-store__grid" });
    entries.forEach((entry) => this.renderScriptCard(grid, entry));
  }

  private getFilteredEntries(): ScriptStoreEntry[] {
    if (!this.catalog) {
      return [];
    }
    const featuredRank = new Map(
      this.catalog.scripts
        .filter((entry) => entry.categories.includes(FEATURED_CATEGORY))
        .map((entry) => [
          entry.name,
          entry.featuredRank ?? Number.MAX_SAFE_INTEGER,
        ]),
    );
    return this.catalog.scripts
      .filter((entry) => {
        const state = this.installStates.get(entry.name) ?? "error";
        if (this.storeView === "installed" && state === "install") {
          return false;
        }
        if (
          this.selectedCategory &&
          !entry.categories.includes(this.selectedCategory)
        ) {
          return false;
        }
        if (!this.searchQuery) {
          return true;
        }
        const searchable = [
          entry.name,
          entry.author,
          entry.categories.join(" "),
          this.getDescription(entry),
        ]
          .join(" ")
          .toLowerCase();
        return searchable.includes(this.searchQuery);
      })
      .sort((a, b) => {
        const aRank = featuredRank.get(a.name);
        const bRank = featuredRank.get(b.name);
        if (aRank !== undefined && bRank !== undefined) {
          return aRank - bRank;
        }
        if (aRank !== undefined) {
          return -1;
        }
        if (bRank !== undefined) {
          return 1;
        }
        return a.name.localeCompare(b.name);
      });
  }

  private renderScriptCard(parent: HTMLElement, entry: ScriptStoreEntry): void {
    const state = this.installStates.get(entry.name) ?? "error";
    const card = parent.createDiv({ cls: "excalidraw-script-store__card" });
    if (state === "update") {
      card.classList.add("has-update");
    }
    const main = card.createEl("button", {
      cls: "excalidraw-script-store__card-main",
      type: "button",
      attr: { "aria-label": `${t("SCRIPT_STORE_DETAILS")}: ${entry.name}` },
    });
    main.addEventListener("click", () => this.renderDetail(entry));

    const iconWrap = main.createDiv({ cls: "excalidraw-script-store__icon" });
    const fallback = iconWrap.createSpan({
      cls: "excalidraw-script-store__icon-fallback",
    });
    setIcon(fallback, "scroll-text");
    const image = iconWrap.createEl("img", {
      attr: { src: getScriptIconUrl(entry), alt: "", loading: "lazy" },
    });
    image.addEventListener(
      "error",
      () => {
        image.classList.add("is-hidden");
        fallback.classList.add("is-visible");
      },
      { once: true },
    );

    const text = main.createDiv({ cls: "excalidraw-script-store__card-text" });
    const titleRow = text.createDiv({
      cls: "excalidraw-script-store__title-row",
    });
    titleRow.createEl("h3", { text: entry.name });
    this.renderStateBadge(titleRow, state);
    if (entry.categories.includes(FEATURED_CATEGORY)) {
      const featured = titleRow.createSpan({
        cls: "excalidraw-script-store__badge is-featured",
        text: t("SCRIPT_STORE_FEATURED"),
      });
      const icon = featured.createSpan();
      setIcon(icon, "sparkles");
    }
    if (entry.author) {
      text.createDiv({
        cls: "excalidraw-script-store__author",
        text: `${t("SCRIPT_STORE_BY")} ${entry.author}`,
      });
    }
    text.createEl("p", { text: this.getDescription(entry) });

    const footer = card.createDiv({
      cls: "excalidraw-script-store__card-footer",
    });
    const categoryText = entry.categories
      .filter((name) => name !== FEATURED_CATEGORY)
      .slice(0, 2)
      .join(" · ");
    footer.createSpan({ text: categoryText });
    const action = footer.createEl("button", {
      text: this.getActionLabel(state),
      type: "button",
      cls: state === "update" ? "mod-cta" : undefined,
    });
    action.disabled = state === "up-to-date";
    action.addEventListener("click", (event) => {
      event.stopPropagation();
      void this.installEntry(entry, action);
    });
  }

  private renderStateBadge(
    parent: HTMLElement,
    state: ScriptStoreInstallState,
  ): void {
    if (state === "install") {
      return;
    }
    const badge = parent.createSpan({
      cls: [
        "excalidraw-script-store__badge",
        state === "update" ? "has-update" : "is-installed",
      ],
      text:
        state === "update"
          ? t("SCRIPT_STORE_UPDATE_BADGE")
          : state === "error"
            ? t("SCRIPT_STORE_CHECK_FAILED")
            : t("SCRIPT_STORE_INSTALLED_BADGE"),
    });
    const icon = badge.createSpan();
    setIcon(icon, state === "update" ? "circle-arrow-up" : "check");
  }

  private getDescription(entry: ScriptStoreEntry): string {
    const cached = this.descriptionText.get(entry.file);
    if (cached !== undefined) {
      return cached;
    }
    const description = (
      sanitizedFragment(entry.descriptionHtml).textContent ?? ""
    )
      .replace(/\s+/g, " ")
      .trim();
    this.descriptionText.set(entry.file, description);
    return description;
  }

  private getActionLabel(state: ScriptStoreInstallState): string {
    switch (state) {
      case "install":
        return t("SCRIPT_STORE_INSTALL");
      case "update":
        return t("SCRIPT_STORE_UPDATE");
      case "up-to-date":
        return t("SCRIPT_STORE_INSTALLED_BADGE");
      case "error":
        return t("SCRIPT_STORE_REINSTALL");
    }
  }

  private getDetailActionLabel(state: ScriptStoreInstallState): string {
    return state === "up-to-date"
      ? t("SCRIPT_STORE_REINSTALL")
      : this.getActionLabel(state);
  }

  private async installEntry(
    entry: ScriptStoreEntry,
    button: HTMLButtonElement,
    stayOnDetail = false,
  ): Promise<void> {
    button.disabled = true;
    button.setText(t("SCRIPT_STORE_UPDATING"));
    try {
      await installScript(this.plugin, getScriptInstallUrl(entry), false);
      this.installStates.set(entry.name, "up-to-date");
      new Notice(`${t("SCRIPT_INSTALLED_NOTICE")}: ${entry.name}`);
      if (stayOnDetail) {
        this.renderDetail(entry);
      } else {
        this.renderStore();
      }
    } catch {
      this.installStates.set(entry.name, "error");
      new Notice(`${t("SCRIPT_INSTALL_ERROR_NOTICE")}: ${entry.name}`);
      button.disabled = false;
      button.setText(t("SCRIPT_STORE_REINSTALL"));
    }
  }

  private renderDetail(entry: ScriptStoreEntry): void {
    const state = this.installStates.get(entry.name) ?? "error";
    this.contentDiv.replaceChildren();
    const back = this.contentDiv.createEl("button", {
      text: t("SCRIPT_STORE_BACK"),
      cls: "excalidraw-script-store__back",
      type: "button",
    });
    const backIcon = back.createSpan();
    setIcon(backIcon, "arrow-left");
    back.addEventListener("click", () => this.renderStore());

    const detail = this.contentDiv.createDiv({
      cls: "excalidraw-script-store__detail",
    });
    const hero = detail.createDiv({
      cls: "excalidraw-script-store__detail-hero",
    });
    const iconWrap = hero.createDiv({
      cls: "excalidraw-script-store__detail-icon",
    });
    const fallback = iconWrap.createSpan({
      cls: "excalidraw-script-store__detail-icon-fallback",
    });
    setIcon(fallback, "scroll-text");
    const image = iconWrap.createEl("img", {
      attr: { src: getScriptIconUrl(entry), alt: "", loading: "lazy" },
    });
    image.addEventListener(
      "error",
      () => {
        image.classList.add("is-hidden");
        fallback.classList.add("is-visible");
      },
      { once: true },
    );

    const title = hero.createDiv({
      cls: "excalidraw-script-store__detail-title",
    });
    title.createEl("h1", { text: entry.name });
    if (entry.author) {
      const byline = title.createDiv({
        cls: "excalidraw-script-store__detail-byline",
      });
      byline.append(`${t("SCRIPT_STORE_BY")} `);
      if (entry.authorUrl) {
        byline.createEl("a", {
          text: entry.author,
          href: entry.authorUrl,
          attr: { target: "_blank", rel: "noopener noreferrer" },
        });
      } else {
        byline.append(entry.author);
      }
    }
    const tags = title.createDiv({
      cls: "excalidraw-script-store__detail-tags",
    });
    entry.categories.forEach((category) =>
      tags.createSpan({ text: category, cls: "excalidraw-script-store__tag" }),
    );

    const actions = title.createDiv({
      cls: "excalidraw-script-store__detail-actions",
    });
    const install = actions.createEl("button", {
      text: this.getDetailActionLabel(state),
      type: "button",
      cls: state === "update" || state === "install" ? "mod-cta" : undefined,
    });
    install.addEventListener("click", () => {
      void this.installEntry(entry, install, true);
    });
    actions.createEl("a", {
      text: t("SCRIPT_STORE_VIEW_SOURCE"),
      href: getScriptSourceUrl(entry),
      cls: "excalidraw-script-store__source-link",
      attr: { target: "_blank", rel: "noopener noreferrer" },
    });

    if (state !== "install") {
      this.renderInstalledScriptManagement(detail, entry);
    }

    const description = detail.createDiv({
      cls: "excalidraw-script-store__detail-description",
    });
    setSanitizedHtml(description, entry.descriptionHtml);
    description.querySelectorAll("a").forEach((link) => {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    });
  }

  private renderInstalledScriptManagement(
    parent: HTMLElement,
    entry: ScriptStoreEntry,
  ): void {
    const source = getScriptInstallUrl(entry);
    const localFiles = getInstalledScriptFiles(this.plugin, source);
    if (localFiles.length === 0) {
      return;
    }

    const section = parent.createDiv({
      cls: "excalidraw-script-store__local-management",
    });
    section.createEl("h2", { text: t("SCRIPT_STORE_LOCAL_TITLE") });

    if (localFiles.length > 1) {
      section.createDiv({
        cls: "excalidraw-script-store__local-note",
        text: t("SCRIPT_STORE_MULTIPLE_COPIES"),
      });
    }

    if (this.plugin.settings.storeScriptFilesAsJavaScript) {
      section.createDiv({
        cls: "excalidraw-script-store__local-note",
        text: t("SCRIPT_STORE_JS_OPEN_NOTE"),
      });
    }

    const groups = getInstalledScriptGroups(this.plugin);
    localFiles.forEach((localFile, index) => {
      const copy = section.createDiv({
        cls: "excalidraw-script-store__local-copy",
      });
      if (localFiles.length > 1) {
        copy.createDiv({
          cls: "excalidraw-script-store__local-copy-label",
          text:
            index === 0
              ? t("SCRIPT_STORE_PRIMARY_COPY")
              : t("SCRIPT_STORE_ADDITIONAL_COPY"),
        });
      }

      const fileRow = copy.createDiv({
        cls: "excalidraw-script-store__local-row",
      });
      const fileInfo = fileRow.createDiv({
        cls: "excalidraw-script-store__local-info",
      });
      fileInfo.createEl("strong", { text: t("SCRIPT_STORE_LOCAL_FILE") });
      fileInfo.createEl("code", { text: localFile.path });

      const fileActions = fileRow.createDiv({
        cls: "excalidraw-script-store__local-actions",
      });
      const openButton = fileActions.createEl("button", {
        text: t("SCRIPT_STORE_OPEN_LOCAL"),
        type: "button",
      });
      openButton.onClickEvent(() => {
        void this.openLocalScript(localFile.path);
      });
      const uninstallButton = fileActions.createEl("button", {
        text: t("SCRIPT_STORE_UNINSTALL"),
        type: "button",
        cls: "mod-warning",
      });
      uninstallButton.onClickEvent(() => {
        void this.uninstallEntry(entry, uninstallButton, localFile.path);
      });

      const downloadedRoot = normalizePath(
        `${this.plugin.settings.scriptFolderPath}/${SCRIPT_INSTALL_FOLDER}`,
      );
      const currentGroup =
        localFile.parent?.path === downloadedRoot
          ? ""
          : localFile.parent?.path.slice(downloadedRoot.length + 1) ?? "";
      const groupRow = copy.createDiv({
        cls: "excalidraw-script-store__group-row",
      });
      const groupLabel = groupRow.createEl("label", {
        text: t("SCRIPT_STORE_GROUP_LABEL"),
      });
      const groupControls = groupRow.createDiv({
        cls: "excalidraw-script-store__group-controls",
      });
      const groupSelect = groupControls.createEl("select", {
        attr: {
          id: `excalidraw-script-store-group-${index}`,
          "aria-label": t("SCRIPT_STORE_GROUP_LABEL"),
        },
      });
      groupSelect.createEl("option", {
        text: t("SCRIPT_STORE_GROUP_ROOT"),
        value: "",
      });
      groups.forEach((group) => {
        groupSelect.createEl("option", { text: group, value: group });
      });
      if (
        currentGroup &&
        !Array.from(groupSelect.options).some(
          (option) => option.value === currentGroup,
        )
      ) {
        groupSelect.createEl("option", {
          text: currentGroup,
          value: currentGroup,
        });
      }
      groupSelect.value = currentGroup;
      groupLabel.htmlFor = groupSelect.id;

      const newGroup = groupControls.createEl("input", {
        type: "text",
        placeholder: t("SCRIPT_STORE_NEW_GROUP_PLACEHOLDER"),
        attr: { "aria-label": t("SCRIPT_STORE_NEW_GROUP_PLACEHOLDER") },
      });
      const moveButton = groupControls.createEl("button", {
        text: t("SCRIPT_STORE_MOVE_TO_GROUP"),
        type: "button",
      });
      moveButton.onClickEvent(() => {
        const targetGroup = newGroup.value.trim() || groupSelect.value;
        void this.moveEntryToGroup(
          entry,
          localFile.path,
          targetGroup,
          moveButton,
        );
      });
    });
  }

  private async openLocalScript(localPath: string): Promise<void> {
    const localFile = this.plugin.app.vault.getFileByPath(
      normalizePath(localPath),
    );
    if (!localFile) {
      return;
    }
    try {
      this.close();
      await this.plugin.app.workspace.getLeaf(true).openFile(localFile, {
        active: true,
      });
    } catch (error: unknown) {
      errorlog({
        where: "ScriptInstallPrompt.openLocalScript",
        source: localFile.path,
        error,
      });
      new Notice(t("SCRIPT_STORE_OPEN_LOCAL_FAILED"));
    }
  }

  private async uninstallEntry(
    entry: ScriptStoreEntry,
    button: HTMLButtonElement,
    localPath: string,
  ): Promise<void> {
    button.disabled = true;
    try {
      const source = getScriptInstallUrl(entry);
      await uninstallScript(this.plugin, source, localPath);
      if (getInstalledScriptFiles(this.plugin, source).length === 0) {
        this.installStates.set(entry.name, "install");
      }
      new Notice(`${t("SCRIPT_STORE_UNINSTALLED")}: ${entry.name}`);
      this.renderDetail(entry);
    } catch (error: unknown) {
      errorlog({
        where: "ScriptInstallPrompt.uninstallEntry",
        source: localPath,
        error,
      });
      new Notice(`${t("SCRIPT_STORE_UNINSTALL_FAILED")}: ${entry.name}`);
      button.disabled = false;
    }
  }

  private async moveEntryToGroup(
    entry: ScriptStoreEntry,
    localPath: string,
    targetGroup: string,
    button: HTMLButtonElement,
  ): Promise<void> {
    button.disabled = true;
    try {
      const source = getScriptInstallUrl(entry);
      await moveInstalledScriptToGroup(
        this.plugin,
        source,
        targetGroup,
        localPath,
      );
      new Notice(`${t("SCRIPT_STORE_MOVED_TO_GROUP")}: ${entry.name}`);
      this.renderDetail(entry);
    } catch (error: unknown) {
      errorlog({
        where: "ScriptInstallPrompt.moveEntryToGroup",
        source: localPath,
        error,
      });
      new Notice(`${t("SCRIPT_STORE_MOVE_FAILED")}: ${entry.name}`);
      button.disabled = false;
    }
  }

  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
