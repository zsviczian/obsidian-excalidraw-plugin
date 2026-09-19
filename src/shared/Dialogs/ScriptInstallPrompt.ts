import {
  Component,
  MarkdownRenderer,
  Modal,
  Notice,
  request,
  setIcon,
} from "obsidian";
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
  getScriptInstallState,
  installScript,
  type ScriptLibraryPluginContext,
} from "../../utils/scriptLibraryUtils";
import { errorlog } from "../../utils/utils";
import { log } from "../../utils/debugHelper";
import { ContentSearcher } from "../components/ContentSearcher";

const LEGACY_URL =
  URLs.RAW_GITHUBUSERCONTENT_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_MASTER_EA_SCRIPTS_INDEX_NEW_MD;
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

const rewriteLegacyInstallUrls = (source: string): string =>
  source.replace(
    /(```excalidraw-script-install\s*\r?\n)([^\r\n]+)(\r?\n```)/g,
    (match, opening: string, installUrl: string, closing: string) => {
      try {
        const filename = decodeURIComponent(
          new URL(installUrl.trim()).pathname.split("/").pop() ?? "",
        );
        if (!/\.(?:md|js)$/i.test(filename)) {
          return match;
        }
        return `${opening}${getPluginRepositoryRawUrl(`ea-scripts/${filename}`)}${closing}`;
      } catch {
        return match;
      }
    },
  );

export class ScriptInstallPrompt extends Modal {
  private contentDiv: HTMLDivElement;
  private renderComponent: Component;
  private catalog: ScriptStoreCatalog | null = null;
  private installStates = new Map<string, ScriptStoreInstallState>();
  private selectedCategory = "";
  private searchQuery = "";
  private storeView: StoreView = "all";

  constructor(private plugin: ScriptLibraryPluginContext) {
    super(plugin.app);
  }

  onOpen(): void {
    this.titleEl.setText(t("SCRIPT_STORE_TITLE"));
    this.renderComponent = new Component();
    this.renderComponent.load();
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
      await this.renderLegacyStore();
    }
  }

  private async refreshInstallStates(): Promise<void> {
    if (!this.catalog) {
      return;
    }
    const stateEntries = await Promise.all(
      this.catalog.scripts.map(async (entry) =>
        [
          entry.name,
          await getScriptInstallState(this.plugin, getScriptInstallUrl(entry)),
        ] as const,
      ),
    );
    this.installStates = new Map(stateEntries);
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
    return (sanitizedFragment(entry.descriptionHtml).textContent ?? "")
      .replace(/\s+/g, " ")
      .trim();
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
      await installScript(this.plugin, getScriptInstallUrl(entry), false);
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
      text: this.getActionLabel(state),
      type: "button",
      cls: state === "update" || state === "install" ? "mod-cta" : undefined,
    });
    install.disabled = state === "up-to-date";
    install.addEventListener("click", () => {
      void this.installEntry(entry, install);
    });
    actions.createEl("a", {
      text: t("SCRIPT_STORE_VIEW_SOURCE"),
      href: getScriptSourceUrl(entry),
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
      this.contentDiv.replaceChildren();
      new ContentSearcher(this.contentDiv);
      await MarkdownRenderer.render(
        this.plugin.app,
        rewriteLegacyInstallUrls(source),
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
    this.contentEl.replaceChildren();
    this.renderComponent.unload();
  }
}
