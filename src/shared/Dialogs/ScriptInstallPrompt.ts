import {
  Component,
  MarkdownRenderer,
  Modal,
  Notice,
  request,
  setIcon,
} from "obsidian";
import ExcalidrawPlugin from "../../core/main";
import { errorlog } from "../../utils/utils";
import { log } from "src/utils/debugHelper";
import { ContentSearcher } from "../components/ContentSearcher";
import {
  getYouTubeThumbnailUrl,
  getYouTubeUrl,
  URLs,
} from "src/constants/safeUrls";
import { t } from "src/lang/helpers";
import type {
  ScriptStoreCatalog,
  ScriptStoreEntry,
  ScriptStoreInstallState,
} from "src/types/scriptStoreTypes";
import type { GitHubRepositoryContentFile } from "src/types/githubTypes";
import {
  getRemoteScriptFiles,
  getScriptInstallState,
  installScript,
} from "src/utils/scriptLibraryUtils";
import { sanitizedFragment, setSanitizedHtml } from "src/utils/htmlUtils";

const LEGACY_URL =
  URLs.RAW_GITHUBUSERCONTENT_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_MASTER_EA_SCRIPTS_INDEX_NEW_MD;
const CATALOG_URL =
  URLs.RAW_GITHUBUSERCONTENT_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_MASTER_EA_SCRIPTS_SCRIPT_STORE_JSON;
const FEATURED_CATEGORY = "Editors Picks";

type StoreView = "all" | "installed";

export class ScriptInstallPrompt extends Modal {
  private contentDiv: HTMLDivElement;
  private renderComponent: Component;
  private catalog: ScriptStoreCatalog | null = null;
  private installStates = new Map<string, ScriptStoreInstallState>();
  private selectedCategory = "";
  private searchQuery = "";
  private storeView: StoreView = "all";
  private remoteFiles: Map<string, GitHubRepositoryContentFile> | null = null;

  constructor(private plugin: ExcalidrawPlugin) {
    super(plugin.app);
  }

  onOpen(): void {
    this.titleEl.setText(t("SCRIPT_STORE_TITLE"));
    this.renderComponent = new Component();
    this.renderComponent.load();
    this.contentEl.addClass("excalidraw-scriptengine-install");
    this.contentEl.addClass("excalidraw-script-store");
    this.containerEl.addClass("excalidraw-scriptengine-install");
    this.containerEl.addClass("excalidraw-script-store");
    this.contentDiv = this.contentEl.createDiv({
      cls: "excalidraw-script-store__content",
    });
    this.renderLoading();
    void this.loadStore();
  }

  private renderLoading(): void {
    this.contentDiv.empty();
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
      const [source, remoteFiles] = await Promise.all([
        request({ url: CATALOG_URL }),
        getRemoteScriptFiles(),
      ]);
      const catalog = JSON.parse(source) as ScriptStoreCatalog;
      if (
        catalog?.version !== 1 ||
        !Array.isArray(catalog.scripts) ||
        !Array.isArray(catalog.categories)
      ) {
        throw new Error("Unsupported script store catalog");
      }
      this.catalog = catalog;
      this.remoteFiles = remoteFiles;
      await this.refreshInstallStates();
      this.renderStore();
    } catch (error: unknown) {
      errorlog({ where: "ScriptInstallPrompt.loadStore", error });
      await this.renderLegacyStore();
    }
  }

  private async refreshInstallStates(): Promise<void> {
    if (!this.catalog) {
      return;
    }
    const stateEntries = await Promise.all(
      this.catalog.scripts.map(async (entry) => [
        entry.name,
        await getScriptInstallState(
          this.plugin,
          entry.installUrl,
          this.remoteFiles,
        ),
      ] as const),
    );
    this.installStates = new Map(stateEntries);
  }

  private renderStore(): void {
    if (!this.catalog) {
      return;
    }
    this.contentDiv.empty();
    this.renderIntro();
    this.renderUpdates();
    this.renderBrowseControls();
    this.renderScriptGrid();
  }

  private renderIntro(): void {
    const intro = this.contentDiv.createDiv({
      cls: "excalidraw-script-store__intro-grid",
    });
    this.renderFeatureCard(
      intro,
      "wand-sparkles",
      t("SCRIPT_STORE_AUTOMATE_TITLE"),
      t("SCRIPT_STORE_AUTOMATE_DESC"),
      t("SCRIPT_STORE_AUTOMATE_ACTION"),
      getYouTubeUrl("hePJcObHIso"),
    );
    this.renderVideoFeatureCard(
      intro,
      getYouTubeThumbnailUrl("6BjhUyfS4iM"),
      t("SCRIPT_STORE_AI_TITLE"),
      t("SCRIPT_STORE_AI_DESC"),
      t("SCRIPT_STORE_AI_ACTION"),
      getYouTubeUrl("6BjhUyfS4iM"),
    );
    this.renderFeatureCard(
      intro,
      "git-pull-request",
      t("SCRIPT_STORE_PUBLISH_TITLE"),
      t("SCRIPT_STORE_PUBLISH_DESC"),
      t("SCRIPT_STORE_PUBLISH_ACTION"),
      URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_BLOB_MASTER_EA_SCRIPTS_README_MD,
    );
  }

  private renderFeatureCard(
    parent: HTMLElement,
    iconName: string,
    title: string,
    description: string,
    action: string,
    href: string,
  ): void {
    const card = parent.createDiv({ cls: "excalidraw-script-store__feature" });
    const icon = card.createDiv({ cls: "excalidraw-script-store__feature-icon" });
    setIcon(icon, iconName);
    card.createEl("h3", { text: title });
    card.createEl("p", { text: description });
    card.createEl("a", {
      text: action,
      href,
      cls: "excalidraw-script-store__feature-link",
      attr: { target: "_blank", rel: "noopener noreferrer" },
    });
  }

  private renderVideoFeatureCard(
    parent: HTMLElement,
    imageUrl: string,
    title: string,
    description: string,
    action: string,
    href: string,
  ): void {
    const card = parent.createDiv({
      cls: ["excalidraw-script-store__feature", "is-video"],
    });
    const imageLink = card.createEl("a", {
      href,
      cls: "excalidraw-script-store__feature-image-link",
      attr: { target: "_blank", rel: "noopener noreferrer" },
    });
    imageLink.createEl("img", {
      attr: { src: imageUrl, alt: title, loading: "lazy" },
    });
    card.createEl("h3", { text: title });
    card.createEl("p", { text: description });
    card.createEl("a", {
      text: action,
      href,
      cls: "excalidraw-script-store__feature-link",
      attr: { target: "_blank", rel: "noopener noreferrer" },
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
    const icon = title.createSpan({ cls: "excalidraw-script-store__inline-icon" });
    setIcon(icon, "circle-arrow-up");
    titleWrap.createEl("p", { text: t("SCRIPT_STORE_UPDATES_DESC") });

    const updateAll = header.createEl("button", {
      text: t("SCRIPT_STORE_UPDATE_ALL"),
      cls: "mod-cta",
      type: "button",
    });
    updateAll.onClickEvent(() => {
      void this.updateAll(updateAll);
    });

    const list = section.createDiv({ cls: "excalidraw-script-store__update-list" });
    updates.forEach((entry) => {
      const button = list.createEl("button", {
        text: entry.name,
        cls: "excalidraw-script-store__update-chip",
        type: "button",
      });
      button.onClickEvent(() => this.renderDetail(entry));
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
        await installScript(this.plugin, entry.installUrl, false);
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
    button.onClickEvent(() => {
      this.storeView = view;
      parent.querySelectorAll("button").forEach((item) => {
        item.toggleClass("is-active", item === button);
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
    const summary = results.createDiv({
      cls: "excalidraw-script-store__result-summary",
    });
    summary.setText(`${entries.length} ${t("SCRIPT_STORE_RESULTS")}`);
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
        .map((entry) => [entry.name, entry.featuredRank ?? Number.MAX_SAFE_INTEGER]),
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
          sanitizedFragment(entry.descriptionHtml).textContent ?? "",
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
      card.addClass("has-update");
    }
    const main = card.createEl("button", {
      cls: "excalidraw-script-store__card-main",
      type: "button",
      attr: { "aria-label": `${t("SCRIPT_STORE_DETAILS")}: ${entry.name}` },
    });
    main.onClickEvent(() => this.renderDetail(entry));

    const iconWrap = main.createDiv({ cls: "excalidraw-script-store__icon" });
    const fallback = iconWrap.createSpan({
      cls: "excalidraw-script-store__icon-fallback",
    });
    setIcon(fallback, "scroll-text");
    const image = iconWrap.createEl("img", {
      attr: { src: entry.iconUrl, alt: "", loading: "lazy" },
    });
    image.addEventListener("error", () => image.addClass("is-hidden"), {
      once: true,
    });

    const text = main.createDiv({ cls: "excalidraw-script-store__card-text" });
    const titleRow = text.createDiv({ cls: "excalidraw-script-store__title-row" });
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
    text.createEl("p", { text: this.getDescriptionSnippet(entry) });

    const footer = card.createDiv({ cls: "excalidraw-script-store__card-footer" });
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
    action.onClickEvent((event) => {
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

  private getDescriptionSnippet(entry: ScriptStoreEntry): string {
    const text = (sanitizedFragment(entry.descriptionHtml).textContent ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length <= 180) {
      return text;
    }
    return `${text.substring(0, 177).trimEnd()}…`;
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

  private async installEntry(
    entry: ScriptStoreEntry,
    button: HTMLButtonElement,
  ): Promise<void> {
    button.disabled = true;
    button.setText(t("SCRIPT_STORE_UPDATING"));
    try {
      await installScript(this.plugin, entry.installUrl, false);
      this.installStates.set(entry.name, "up-to-date");
      new Notice(`${t("SCRIPT_INSTALLED_NOTICE")}: ${entry.name}`);
      this.renderStore();
    } catch {
      this.installStates.set(entry.name, "error");
      new Notice(`${t("SCRIPT_INSTALL_ERROR_NOTICE")}: ${entry.name}`);
      button.disabled = false;
      button.setText(t("SCRIPT_STORE_REINSTALL"));
    }
  }

  private renderDetail(entry: ScriptStoreEntry): void {
    const state = this.installStates.get(entry.name) ?? "error";
    this.contentDiv.empty();
    const back = this.contentDiv.createEl("button", {
      text: t("SCRIPT_STORE_BACK"),
      cls: "excalidraw-script-store__back",
      type: "button",
    });
    const backIcon = back.createSpan();
    setIcon(backIcon, "arrow-left");
    back.onClickEvent(() => this.renderStore());

    const detail = this.contentDiv.createDiv({
      cls: "excalidraw-script-store__detail",
    });
    const hero = detail.createDiv({ cls: "excalidraw-script-store__detail-hero" });
    const iconWrap = hero.createDiv({ cls: "excalidraw-script-store__detail-icon" });
    const fallback = iconWrap.createSpan();
    setIcon(fallback, "scroll-text");
    const image = iconWrap.createEl("img", {
      attr: { src: entry.iconUrl, alt: "", loading: "lazy" },
    });
    image.addEventListener("error", () => image.addClass("is-hidden"), {
      once: true,
    });

    const title = hero.createDiv({ cls: "excalidraw-script-store__detail-title" });
    title.createEl("h1", { text: entry.name });
    if (entry.author) {
      const byline = title.createDiv({ cls: "excalidraw-script-store__detail-byline" });
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
    const tags = title.createDiv({ cls: "excalidraw-script-store__detail-tags" });
    entry.categories.forEach((category) =>
      tags.createSpan({ text: category, cls: "excalidraw-script-store__tag" }),
    );

    const actions = title.createDiv({ cls: "excalidraw-script-store__detail-actions" });
    const install = actions.createEl("button", {
      text: this.getActionLabel(state),
      type: "button",
      cls: state === "update" || state === "install" ? "mod-cta" : undefined,
    });
    install.onClickEvent(() => void this.installEntry(entry, install));
    actions.createEl("a", {
      text: t("SCRIPT_STORE_VIEW_SOURCE"),
      href: entry.sourceUrl,
      cls: "excalidraw-script-store__source-link",
      attr: { target: "_blank", rel: "noopener noreferrer" },
    });

    const description = detail.createDiv({
      cls: "excalidraw-script-store__detail-description",
    });
    setSanitizedHtml(description, entry.descriptionHtml);
    description.querySelectorAll("a").forEach((link) => {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    });
  }

  private async renderLegacyStore(): Promise<void> {
    try {
      const source = await request({ url: LEGACY_URL });
      if (!source) {
        new Notice(t("SCRIPT_INSTALL_PROMPT_FETCH_ERROR"), 5000);
        log(LEGACY_URL);
        this.close();
        return;
      }
      this.contentDiv.empty();
      new ContentSearcher(this.contentDiv);
      await MarkdownRenderer.render(
        this.plugin.app,
        source,
        this.contentDiv,
        "",
        this.renderComponent,
      );
      this.contentDiv
        .querySelectorAll("h1[data-heading],h2[data-heading],h3[data-heading]")
        .forEach((el) => {
          el.setAttribute("id", el.getAttribute("data-heading") ?? "");
        });
      this.contentDiv.querySelectorAll("a.internal-link").forEach((el) => {
        el.removeAttribute("target");
      });
    } catch (error: unknown) {
      errorlog({ where: "ScriptInstallPrompt.renderLegacyStore", error });
      new Notice(t("SCRIPT_INSTALL_PROMPT_OPEN_ERROR"));
      this.close();
    }
  }

  onClose(): void {
    this.contentEl.empty();
    this.renderComponent.unload();
  }
}
