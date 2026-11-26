import { Component, Menu, Modal, Notice, Platform, TFile, View, type TAbstractFile, type WorkspaceLeaf } from "obsidian";
import { IMAGE_TYPES } from "src/constants/constants";
import type ExcalidrawPlugin from "src/core/main";
import { t } from "src/lang/helpers";
import { KIND_NAMES, VisualResourceGallery, visualResourceButton } from "src/shared/visualResources/VisualResourceGallery";
import { VisualResourceSettings } from "src/shared/visualResources/VisualResourceSettings";
import { resourceInput, showResourceMenu, VisualResourceFilePrompt } from "src/shared/visualResources/resourceDialogs";
import { filterVisualResources, visualResourceKey, VISUAL_RESOURCE_FILTERS } from "src/shared/visualResources/visualResourceModel";
import type { VisualResource, VisualResourceFilter } from "src/types/visualResourceTypes";
import { setElementHidden } from "src/utils/htmlUtils";
import { errorlog } from "src/utils/coreUtils";
import ExcalidrawView from "../ExcalidrawView";
import { ExcalidrawSidepanelView } from "./Sidepanel";
import type { ExcalidrawSidepanelTab } from "./SidepanelTab";
import { VisualResourceMenus } from "./VisualResourceMenus";

type BrowserMode = { kind: "general" } | { kind: "icon"; scriptName: string };
const DEFAULT_FILTERS = VISUAL_RESOURCE_FILTERS.filter(key => key !== "other");

/** One resident native tab serves both Visual Resources and the Icon Library preset. */
export class VisualResourcePanel {
  private tab: ExcalidrawSidepanelTab | null = null;
  private opening: Promise<void> | null = null;
  private target: ExcalidrawView | null = null;
  private mode: BrowserMode = { kind: "general" };
  private selection: Map<string, VisualResource> | null = null;
  private collection = "";
  private readonly collectionsByMode = new Map<string, string>();
  private library = "";
  private disposed = false;
  private revealing = 0;
  private svgSource = false;
  private refresh = () => {};
  private reload = () => {};
  private search: HTMLInputElement | null = null;
  private menu: Menu | null = null;
  private readonly menus: VisualResourceMenus;

  constructor(private readonly plugin: ExcalidrawPlugin) {
    this.menus = new VisualResourceMenus(plugin, () => this.reload(), () => this.target, () => this.svgSource);
    plugin.register(() => { this.disposed = true; this.tab?.close(); });
  }

  private get service() { return this.plugin.visualResources; }
  private get preferences() { return this.plugin.settings.visualResources; }
  private get script() { return this.mode.kind === "icon" ? this.mode.scriptName : undefined; }
  private get filters(): readonly VisualResourceFilter[] { return this.script ? ["icon"] : this.preferences.filters ?? DEFAULT_FILTERS; }
  private get groups(): string[] | undefined {
    return this.script ? this.preferences.iconGroups?.[this.script] ?? this.service.iconSettings(this.script).groups : this.preferences.groups;
  }

  /** Open the one sidepanel tab and preserve the explicitly initiating editor across reveal. */
  public async open(view: ExcalidrawView | null, scriptName?: string): Promise<void> {
    if (this.disposed) return;
    this.target = view;
    const previousScript = this.script;
    if (previousScript !== scriptName) {
      this.collectionsByMode.set(previousScript ?? "", this.collection);
      this.collection = this.collectionsByMode.get(scriptName ?? "") ?? "";
      this.selection = null;
      this.mode = scriptName ? { kind: "icon", scriptName } : { kind: "general" };
    }
    this.refresh();
    this.revealing++;
    try {
      this.opening ??= this.tab ? Promise.resolve() : this.create().finally(() => { this.opening = null; });
      await this.opening;
      this.opening = null;
      const panel = ExcalidrawSidepanelView.getExisting(false);
      if (!this.tab || !panel || this.disposed) return;
      this.tab.open(false);
      this.search?.focus();
      await panel.reveal();
      this.search?.focus();
      if (previousScript !== this.script) this.reload();
      else this.refresh();
    } catch { this.failed(); }
    finally { this.revealing--; }
  }

  private async create(): Promise<void> {
    const panel = await ExcalidrawSidepanelView.getOrCreate(this.plugin, false);
    if (!panel || this.disposed) return;
    const ea = this.plugin.ea.getAPI();
    const tab = await panel.createTab({ title: t("VR_TITLE"), hostEA: ea });
    if (this.disposed) { tab.close(); ea.destroy(); return; }
    this.tab = tab;
    const lifetime = new Component();
    tab.onClose = () => {
      this.menu?.hide();
      this.menu = null;
      lifetime.unload();
      this.service.endDrag();
      ea.destroy();
      this.tab = null; this.target = null; this.search = null;
      this.selection = null;
      this.refresh = this.reload = () => {};
    };
    lifetime.load();
    this.mount(panel, tab, lifetime);
  }

  private mount(panel: ExcalidrawSidepanelView, tab: ExcalidrawSidepanelTab, lifetime: Component): void {
    const root = tab.contentEl.createDiv({ cls: "excalidraw-resource-browser" });
    const toolbar = root.createDiv({ cls: "excalidraw-resource-toolbar" });
    const search = this.search = toolbar.createEl("input", { type: "search", placeholder: t("VR_SEARCH"), attr: { "aria-label": t("VR_SEARCH") } });
    const filter = visualResourceButton(toolbar, "filter", t("VR_FILTER"));
    const collections = visualResourceButton(toolbar, "folder", t("VR_COLLECTIONS"));
    const popout = Platform.isDesktopApp ? visualResourceButton(toolbar, "external-link", t("VR_POPOUT")) : null;
    const help = visualResourceButton(toolbar, "info", t("VR_HELP"));
    const settings = visualResourceButton(toolbar, "settings", t("VR_SETTINGS"));
    const layout = visualResourceButton(toolbar, "list", t("VR_LAYOUT"), this.preferences.list);
    const select = visualResourceButton(toolbar, "list-checks", t("VR_SELECT"), false);
    const status = root.createDiv({ cls: "excalidraw-resource-status", attr: { "aria-live": "polite" } });
    const main = root.createDiv({ cls: "excalidraw-resource-main" });
    const details = root.createDiv({ cls: "excalidraw-resource-frames" });
    const heading = details.createDiv({ cls: "excalidraw-resource-toolbar" });
    const back = visualResourceButton(heading, "chevron-left", t("VR_BACK"));
    const parent = heading.createSpan();
    let selectedParent: VisualResource | null = null;
    let frames: VisualResource[] = [], data: VisualResource[] = [], curatedFrames: VisualResource[] = [];
    let load = 0, frameLoad = 0, closed = false, loading = true;
    const open = (resource: VisualResource): void => { void this.service.openSource(resource).catch(() => this.failed()); };
    const closeFrames = () => { frameLoad++; selectedParent = null; frames = []; refresh(false); };
    const activate = (resource: VisualResource) => {
      if (this.selection) {
        const key = visualResourceKey(resource.locator);
        if (this.selection.has(key)) this.selection.delete(key); else this.selection.set(key, resource);
        refresh(false);
        return;
      }
      const target = this.target;
      void this.service.insert(resource, target, () => this.tab === tab && this.target === target, undefined, this.script);
    };
    const actions = {
      activate, open,
      deferredActivation: (resource: VisualResource) => {
        const target = this.target, api = target?.excalidrawAPI, file = target?.file, mode = this.mode;
        return () => {
          if (this.target === target && target?.excalidrawAPI === api && target?.file === file && this.mode === mode && !this.selection) activate(resource);
        };
      },
      canActivate: () => !!this.selection || this.service.writable(this.target),
      favorite: (resource: VisualResource) => this.run(this.service.collections.curate([resource.locator], {
        favorite: !this.service.collections.state(resource.locator).favorite,
      })),
      menu: (resource: VisualResource, el: HTMLElement, event: MouseEvent) => this.show(this.menus.resource(resource, this.collection, () => this.tab === tab, value => { this.svgSource = value; }), el, event),
      frames: (resource: VisualResource) => {
        const revision = ++frameLoad;
        selectedParent = resource;
        frames = [];
        refresh(false);
        void this.service.frames(resource, this.script).then(result => {
          if (revision !== frameLoad || closed) return;
          frames = result;
          refresh(false);
        }).catch(() => this.failed());
      },
      inspectFrames: (resource: VisualResource) => this.service.frames(resource, this.script)
        .then(frames => filterVisualResources(frames, "", ["drawing"], this.groups)),
      drag: (resource: VisualResource, transfer: DataTransfer) => this.service.startDrag(transfer, resource),
      escape: () => { if (selectedParent) closeFrames(); else tab.close(); },
      selected: (resource: VisualResource) => this.selection?.has(visualResourceKey(resource.locator)),
    };
    const gallery = lifetime.addChild(new VisualResourceGallery(main, this.service, actions));
    const childGallery = lifetime.addChild(new VisualResourceGallery(details, this.service, actions));
    const refresh = (reset = true) => {
      const scroll = main.scrollTop;
      const group = this.collection;
      const candidates = group ? [...data, ...curatedFrames].filter(resource => {
        const record = this.service.collections.state(resource.locator);
        return group === "favorites" ? record.favorite : record.memberships.includes(group);
      }) : data;
      const resources = filterVisualResources(candidates, search.value, this.filters, this.groups)
        .filter(resource => !this.library || resource.locator.provider !== "stencil" || resource.locator.path === this.library);
      const old = this.service.iconSettings(this.script);
      const dark = root.ownerDocument.body.hasClass("theme-dark");
      const background = dark ? this.preferences.darkBackground ?? old.darkBackground : this.preferences.lightBackground ?? old.lightBackground;
      const options = { list: this.preferences.list, size: this.preferences.thumbnailSize ?? old.thumbnailSize, background };
      status.setText(loading ? t("VR_LOADING") : !this.service.writable(this.target) ? t("VR_NO_DRAWING") : "");
      select.setAttribute("aria-pressed", String(!!this.selection));
      gallery.show(resources, options, reset);
      setElementHidden(details, !selectedParent);
      if (selectedParent) {
        parent.setText(selectedParent.title);
        const allowedFrames = filterVisualResources(frames, "", ["drawing"], this.groups);
        const matchingFrames = filterVisualResources(allowedFrames, search.value, ["drawing"]);
        childGallery.show(matchingFrames.length ? matchingFrames : allowedFrames, { ...options, list: true }, reset);
      }
      if (!reset) main.scrollTop = scroll;
    };
    this.refresh = () => refresh(false);
    const reload = () => {
      const revision = ++load;
      loading = true;
      status.setText(t("VR_LOADING"));
      const progressive = (resources: VisualResource[]) => {
        if (closed || revision !== load) return;
        data = resources;
        refresh(false);
      };
      void Promise.all([this.service.list(this.script, progressive), this.collection ? this.service.curatedFrames() : []]).then(([resources, curated]) => {
        if (closed || revision !== load) return;
        data = resources;
        curatedFrames = curated;
        loading = false;
        refresh(false);
      }).catch((error: unknown) => {
        if (closed || revision !== load) return;
        loading = false;
        status.setText(t("VR_ACTION_FAILED"));
        errorlog({ where: "VisualResourcePanel.reload", error });
      });
    };
    this.reload = reload;
    let pending: { id: number; win: Window } | null = null;
    const cancelScheduled = () => { if (pending) pending.win.clearTimeout(pending.id); pending = null; };
    const schedule = () => {
      cancelScheduled();
      const win = root.ownerDocument.defaultView;
      pending = { win, id: win.setTimeout(() => { pending = null; reload(); }, 150) };
    };
    const followLeaf = (leaf: WorkspaceLeaf | null) => {
      if (this.revealing || leaf === panel.leaf || root.contains(root.ownerDocument.activeElement)) return;
      if (this.plugin.app.workspace.getActiveViewOfType(View) !== leaf?.view) return;
      const view = leaf?.view instanceof ExcalidrawView ? leaf.view : null;
      if (view === this.target) return;
      this.target = view;
      gallery.cancelClick(); childGallery.cancelClick();
      refresh(false);
    };
    lifetime.register(() => { closed = true; cancelScheduled(); });
    lifetime.register(this.service.collections.subscribe(schedule));
    const vault = this.plugin.app.vault;
    const changed = (file: TAbstractFile) => {
      this.service.invalidatePreview(file.path);
      if (!(file instanceof TFile) || file.extension !== "md" || this.plugin.isExcalidrawFile(file) ||
          this.service.collections.curated.some(record => record.locator.provider === "vault" && record.locator.path === file.path) ||
          this.plugin.app.metadataCache.getBacklinksForFile?.(file)?.data?.size) schedule();
    };
    lifetime.registerEvent(vault.on("create", changed));
    lifetime.registerEvent(vault.on("modify", changed));
    lifetime.registerEvent(vault.on("delete", changed));
    lifetime.registerEvent(vault.on("rename", (file, oldPath) => { this.service.invalidatePreview(oldPath); changed(file); }));
    lifetime.registerEvent(this.plugin.app.metadataCache.on("changed", changed));
    lifetime.registerEvent(this.plugin.app.workspace.on("active-leaf-change", followLeaf));
    tab.onWindowMigrated = () => {
      this.service.endDrag(); cancelScheduled(); gallery.cancelClick(); childGallery.cancelClick(); refresh(false);
    };
    tab.onFocus = () => this.refresh();
    tab.onExcalidrawViewClosed = () => { this.target = null; this.refresh(); };
    back.onclick = closeFrames;
    search.oninput = () => { gallery.cancelClick(); childGallery.cancelClick(); refresh(); };
    search.onkeydown = event => {
      if (event.key === "ArrowDown") { event.preventDefault(); gallery.focusFirst(); }
      if (event.key === "Escape") actions.escape();
    };
    filter.onclick = () => void this.filterMenu(filter, () => refresh()).catch(() => this.failed());
    collections.onclick = () => this.show(this.collectionsMenu(collections), collections);
    if (popout) popout.onclick = () => {
      const docked = root.ownerDocument === this.plugin.app.workspace.containerEl.ownerDocument;
      ExcalidrawSidepanelView.applyLocationPreference(this.plugin, docked);
      void panel.reveal();
    };
    help.onclick = () => {
      const modal = new Modal(this.plugin.app);
      modal.setTitle(t("VR_TITLE"));
      modal.contentEl.createEl("p", { text: t("VR_HELP_TEXT") });
      modal.open();
    };
    settings.onclick = () => new VisualResourceSettings(this.plugin, reload, this.script).open();
    layout.onclick = () => {
      this.preferences.list = !this.preferences.list;
      layout.setAttribute("aria-pressed", String(this.preferences.list));
      this.run(this.plugin.saveSettings());
      refresh(false);
    };
    select.onclick = () => {
      this.selection = this.selection ? null : new Map<string, VisualResource>();
      select.setAttribute("aria-pressed", String(!!this.selection));
      refresh(false);
    };
    refresh();
    void this.service.collections.refresh().catch(() => this.failed());
    reload();
  }

  private async filterMenu(button: HTMLElement, refresh: () => void): Promise<void> {
    const menu = new Menu();
    if (!this.script) for (const key of VISUAL_RESOURCE_FILTERS) menu.addItem(item =>
      item.setTitle(t(KIND_NAMES[key])).setChecked(this.filters.includes(key)).onClick(() => {
        this.preferences.filters = this.filters.includes(key) ? this.filters.filter(filter => filter !== key) : [...this.filters, key];
        this.run(this.plugin.saveSettings()); refresh();
      }));
    const rules = this.service.rules(this.script);
    const groups = Object.entries(rules).flatMap(([kind, definitions]) => definitions.map(rule => [kind + ":" + rule.name, rule.name]));
    if (groups.length) menu.addSeparator();
    for (const [key, label] of groups.filter(([key]) => !this.script || key.startsWith("icon:"))) menu.addItem(item =>
      item.setTitle(label).setChecked(this.groups?.includes(key) ?? true).onClick(() => {
        const current = this.groups ?? groups.map(([group]) => group);
        const next = current.includes(key) ? current.filter(group => group !== key) : [...current, key];
        if (this.script) (this.preferences.iconGroups ??= {})[this.script] = next;
        else this.preferences.groups = next;
        this.run(this.plugin.saveSettings());
        refresh();
      }));
    if (!this.script && this.filters.includes("stencil")) {
      const { paths } = await this.plugin.stencilLibraryManager.getResourceLibraries();
      menu.addSeparator();
      for (const path of ["", ...paths]) menu.addItem(item =>
        item.setTitle(path || t("VR_ALL_LIBRARIES")).setChecked(this.library === path).onClick(() => { this.library = path; refresh(); }));
      menu.addItem(item => item.setTitle(t("VR_MANAGE_LIBRARIES")).setIcon("library").onClick(() => void this.menus.manage().catch(() => this.failed())));
    }
    this.show(menu, button);
  }

  private collectionsMenu(anchor: HTMLElement): Menu {
    const menu = new Menu();
    const select = (id: string) => { this.collection = id; this.reload(); };
    for (const [id, title] of [["", t("VR_ALL")], ["favorites", t("VR_FAVORITES")]]) {
      menu.addItem(item => item.setTitle(title).setChecked(this.collection === id).onClick(() => select(id)));
    }
    const playlists = this.service.collections.playlists;
    for (const [id, list] of playlists) menu.addItem(item => item.setTitle(this.menus.playlistName(id) + " (" + list.members.length + ")")
      .setChecked(this.collection === id).onClick(() => select(id)));
    menu.addSeparator();
    const active = playlists.find(([id]) => id === this.collection);
    menu.addItem(item => item.setTitle(t("VR_NEW_PLAYLIST")).setIcon("folder-plus").onClick(async () => {
      const name = await resourceInput(this.plugin.app, t("VR_NEW_PLAYLIST"), { value: "" });
      if (name) this.run(this.service.collections.savePlaylist(name, undefined, active?.[0]));
    }));
    if (active) {
      const [id, playlist] = active;
      menu.addItem(item => item.setTitle(t("VR_RENAME")).onClick(async () => {
        const name = await resourceInput(this.plugin.app, t("VR_RENAME"), { value: playlist.name });
        if (name) this.run(this.service.collections.savePlaylist(name, id, playlist.parent));
      }));
      menu.addItem(item => item.setTitle(t("VR_DELETE_PLAYLIST"))
        .setDisabled(playlists.some(([, list]) => list.parent === id)).onClick(async () => {
          if (await resourceInput(this.plugin.app, t("VR_DELETE_PLAYLIST"), { message: playlist.name, danger: true }) === null) return;
          this.run(this.service.collections.removePlaylist(id).then(() => select("")));
        }));
    }
    menu.addItem(item => item.setTitle(t("VR_ADD_FILE")).onClick(() =>
      new VisualResourceFilePrompt(this.plugin.app, file => IMAGE_TYPES.includes(file.extension.toLowerCase()) || file.extension === "md" || this.plugin.isExcalidrawFile(file),
        file => this.run(this.service.collections.curate([{ provider: "vault", path: file.path }], { manual: true }))).open()));
    if (this.selection?.size) {
      const selected = [...this.selection.values()];
      menu.addItem(item => item.setTitle(t("VR_SELECTED_ACTIONS") + " (" + selected.length + ")")
        .onClick(() => this.show(this.menus.selection(selected, this.collection), anchor)));
    }
    return menu;
  }

  private show(menu: Menu, anchor: HTMLElement, event?: MouseEvent): void {
    if (!anchor.isConnected) return;
    this.menu?.hide();
    this.menu = menu;
    showResourceMenu(menu, anchor, event);
  }

  private run(promise: Promise<unknown>): void { void promise.catch(() => this.failed()); }
  private failed(): void { new Notice(t("VR_ACTION_FAILED")); }
}
