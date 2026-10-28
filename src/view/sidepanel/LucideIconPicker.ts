import { Component, Notice, View, getIcon } from "obsidian";
import type ExcalidrawPlugin from "src/core/main";
import ExcalidrawView from "src/view/ExcalidrawView";
import { getLucideIcons, prepareLucideIcon } from "src/shared/lucideIcons";
import { t } from "src/lang/helpers";
import { ExcalidrawSidepanelView } from "./Sidepanel";
import type { ExcalidrawSidepanelTab } from "./SidepanelTab";
import { setElementHidden } from "src/utils/htmlUtils";

/** Session-local picker; view identity is captured for each guarded publication. */
export class LucideIconPicker {
  private tab: ExcalidrawSidepanelTab | null = null;
  private opening: Promise<void> | null = null;
  private target: ExcalidrawView | null = null;
  private search = "";
  private size = 96;
  private offset = 0;
  private busy = false;
  private disposed = false;
  private revealing = 0;
  private targetVersion = 0;
  private refresh: () => void = () => {};

  constructor(private readonly plugin: ExcalidrawPlugin) {
    plugin.register(() => { this.disposed = true; this.tab?.close(); this.target = null; });
  }

  /** Resolves the initiating editor exactly, including popouts; never falls back to another view. */
  public openForEditor(editorId?: string): void {
    if (!editorId) return;
    const view = this.plugin.app.workspace.getLeavesOfType("excalidraw")
      .map(leaf => leaf.view).find((view): view is ExcalidrawView =>
        view instanceof ExcalidrawView && view.excalidrawAPI?.id === editorId);
    if (view) void this.open(view);
  }

  /** Reveals one reusable tab. Opening the picker never inserts or creates a drawing. */
  public async open(view: ExcalidrawView | null): Promise<void> {
    if (this.disposed) return;
    this.target = view;
    const version = ++this.targetVersion;
    this.revealing++;
    try {
      if (!this.tab) {
        this.opening ??= this.create().finally(() => { this.opening = null; });
        await this.opening;
      }
      const panel = ExcalidrawSidepanelView.getExisting(false);
      if (this.disposed || !this.tab || !panel) return;
      this.tab.open(false);
      // Revealing the main-window panel can transiently activate its old drawing
      // while leaving a popout. Preserve the explicit initiating view until reveal completes.
      await this.plugin.app.workspace.revealLeaf(panel.leaf);
      this.tab?.contentEl.querySelector("input")?.focus();
    } catch { new Notice(t("LUCIDE_INSERT_FAILED")); }
    finally {
      this.revealing--;
      if (version === this.targetVersion && !this.disposed && this.tab) this.target = view;
      this.refresh();
    }
  }

  private writable(): boolean {
    const view = this.target;
    return !!view?.file && view.isLoaded && !!view.excalidrawAPI &&
      !view.isClosingOrMigrating() && !view.isSameFileEditingActive() &&
      !view.isPersistenceBusy() && !view.excalidrawAPI.getAppState().viewModeEnabled &&
      this.plugin.app.vault.getFileByPath(view.file.path) === view.file;
  }

  private async create(): Promise<void> {
    const panel = await ExcalidrawSidepanelView.getOrCreate(this.plugin, false);
    if (!panel || this.disposed) return;
    const ea = this.plugin.ea.getAPI();
    const tab = await panel.createTab({ title: t("INSERT_LUCIDE_ICON"), hostEA: ea });
    if (this.disposed) { tab.close(); ea.destroy(); return; }
    this.tab = tab;
    const component = new Component();
    component.load();
    tab.onClose = () => {
      component.unload(); ea.destroy();
      this.tab = null; this.target = null; this.refresh = () => {};
    };
    let stopStatusRefresh = () => {};
    const watchStatus = () => {
      stopStatusRefresh();
      const win = tab.contentEl.ownerDocument.defaultView;
      if (!win) return;
      // Load/save readiness can change without a workspace layout event.
      const timer = win.setInterval(() => { if (tab.isActiveTab()) this.refresh(); }, 250);
      stopStatusRefresh = () => win.clearInterval(timer);
    };
    component.register(() => stopStatusRefresh());
    let pendingTargetUpdate: { win: Window; id: number } | null = null;
    const cancelTargetUpdate = () => {
      if (pendingTargetUpdate) pendingTargetUpdate.win.clearTimeout(pendingTargetUpdate.id);
      pendingTargetUpdate = null;
    };
    component.register(cancelTargetUpdate);
    tab.onWindowMigrated = () => { cancelTargetUpdate(); watchStatus(); this.refresh(); };
    tab.onFocus = () => this.refresh();
    component.registerEvent(this.plugin.app.workspace.on("active-leaf-change", leaf => {
      cancelTargetUpdate();
      if (this.revealing) return;
      const win = tab.contentEl.ownerDocument.defaultView, version = this.targetVersion;
      if (!win) return;
      // Window focus can emit an intermediate main drawing before the sidepanel.
      // Resolve the final active leaf after focus settles, preserving panel-owned focus.
      pendingTargetUpdate = { win, id: win.setTimeout(() => {
        pendingTargetUpdate = null;
        if (this.tab !== tab || this.revealing || version !== this.targetVersion ||
          this.plugin.app.workspace.getActiveViewOfType(View) !== leaf?.view) return;
        if (leaf?.view.containerEl.ownerDocument === tab.contentEl.ownerDocument &&
          tab.contentEl.contains(tab.contentEl.ownerDocument.activeElement)) return;
        if (leaf?.view instanceof ExcalidrawView) this.target = leaf.view;
        else if (leaf !== panel.leaf) this.target = null;
        this.refresh();
      }, 0) };
    }));
    component.registerEvent(this.plugin.app.workspace.on("layout-change", () => this.refresh()));
    const root = tab.contentEl.createDiv({ cls: "excalidraw-lucide-picker" });
    const search = root.createEl("input", { type: "search", placeholder: t("LUCIDE_SEARCH"), attr: { "aria-label": t("LUCIDE_SEARCH") } });
    search.value = this.search;
    const label = root.createEl("label", { text: t("LUCIDE_SIZE") });
    const size = label.createEl("select", { attr: { "aria-label": t("LUCIDE_SIZE") } });
    for (const [value, name] of [[48, "LUCIDE_SMALL"], [96, "LUCIDE_MEDIUM"], [192, "LUCIDE_LARGE"]] as const)
      size.createEl("option", { value: String(value), text: t(name) });
    size.value = String(this.size);
    const status = root.createDiv({ cls: "excalidraw-lucide-status", attr: { "aria-live": "polite" } });
    const grid = root.createDiv({ cls: "excalidraw-lucide-grid" });
    const pages = root.createDiv({ cls: "excalidraw-lucide-pages" });
    const previous = pages.createEl("button", { text: t("LUCIDE_PREVIOUS"), attr: { type: "button" } });
    const next = pages.createEl("button", { text: t("LUCIDE_NEXT"), attr: { type: "button" } });
    let buttons: HTMLButtonElement[] = [];
    this.refresh = () => {
      if (this.tab !== tab) return;
      if (this.target && (this.target.isClosingOrMigrating() || this.target.leaf.view !== this.target)) this.target = null;
      const writable = this.writable(), enabled = writable && !this.busy;
      status.setText(writable ? this.target.file.path : t("LUCIDE_NO_DRAWING"));
      buttons.forEach(button => { button.disabled = !enabled; });
    };
    const render = () => {
      grid.empty(); buttons = [];
      const icons = getLucideIcons(this.search);
      this.offset = Math.max(0, Math.min(this.offset, Math.max(0, Math.ceil(icons.length / 60) - 1) * 60));
      for (const icon of icons.slice(this.offset, this.offset + 60)) {
        const button = grid.createEl("button", { cls: "excalidraw-lucide-icon", attr: { type: "button", "aria-label": icon.name, "data-icon": icon.icon } });
        const svg = getIcon(icon.icon);
        if (svg) { svg.setAttribute("aria-hidden", "true"); button.appendChild(svg); }
        button.createSpan({ text: icon.name });
        buttons.push(button);
      }
      if (!icons.length) grid.createDiv({ text: t("LUCIDE_EMPTY") });
      previous.disabled = this.offset === 0;
      next.disabled = this.offset + 60 >= icons.length;
      setElementHidden(pages, icons.length <= 60);
      this.refresh();
    };
    // One listener survives page/search replacement, including clicks on SVG children.
    component.registerDomEvent(grid, "click", event => {
      const button = buttons.find(button => button.contains(event.target as Node));
      if (button && !button.disabled) void this.insert(button.dataset.icon);
    });
    component.registerDomEvent(search, "input", () => { this.search = search.value; this.offset = 0; render(); });
    component.registerDomEvent(size, "change", () => { this.size = Number(size.value); });
    component.registerDomEvent(previous, "click", () => { this.offset -= 60; render(); });
    component.registerDomEvent(next, "click", () => { this.offset += 60; render(); });
    component.registerDomEvent(root, "keydown", event => {
      event.stopPropagation();
      if (event.target === search) {
        if (event.key === "ArrowDown") { event.preventDefault(); buttons[0]?.focus(); }
        return;
      }
      const index = buttons.indexOf(event.target as HTMLButtonElement);
      if (index < 0) return;
      const columns = Math.max(1, Math.floor((grid.clientWidth + 6) / 70));
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key];
      if (step !== undefined) { event.preventDefault(); buttons[Math.max(0, Math.min(buttons.length - 1, index + step))]?.focus(); }
      if (event.key === "Escape") { event.preventDefault(); search.focus(); }
    });
    render(); watchStatus();
  }

  private async insert(icon: string): Promise<void> {
    if (!this.writable() || this.busy || !this.tab) return;
    const view = this.target, file = view.file, api = view.excalidrawAPI;
    const document = view.ownerDocument, tab = this.tab;
    const same = () => view.file === file && view.excalidrawAPI === api &&
      view.ownerDocument === document && !view.isClosingOrMigrating() &&
      this.plugin.app.vault.getFileByPath(file.path) === file;
    this.busy = true; this.refresh();
    try {
      const state = api.getAppState();
      const prepared = prepareLucideIcon({ icon, size: this.size,
        x: -state.scrollX + state.width / (2 * state.zoom.value) - this.size / 2,
        y: -state.scrollY + state.height / (2 * state.zoom.value) - this.size / 2,
        strokeColor: state.currentItemStrokeColor, roughness: state.currentItemRoughness,
        opacity: state.currentItemOpacity,
      });
      const dx = (this.size - prepared.result.viewport.width) / 2;
      const dy = (this.size - prepared.result.viewport.height) / 2;
      for (const element of prepared.elements) { element.x += dx; element.y += dy; }
      if (!await view.addElements({ newElements: prepared.elements, newElementsOnTop: true, save: false,
        validateBeforePublish: () => {
          if (this.disposed || this.tab !== tab || this.target !== view || !same() || !this.writable())
            throw Error("Stale Lucide insertion target");
        },
      })) throw Error("Lucide insertion was refused");
      if (!same() || this.disposed) throw Error("Lucide insertion target retired before save");
      api.selectElements(prepared.elements);
      const saved = await view.saveWithOutcome();
      if (saved.acknowledgedRevision === null || saved.acknowledgedRevision < saved.requestedRevision)
        throw Error("Lucide insertion save was not acknowledged");
      if (prepared.result.warnings.length) new Notice(t("LUCIDE_APPROXIMATION"));
    } catch { new Notice(t("LUCIDE_INSERT_FAILED")); }
    finally { this.busy = false; this.refresh(); }
  }
}
