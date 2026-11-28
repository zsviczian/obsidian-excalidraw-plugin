import { Component, getIcon, Menu, Notice, Platform, setTooltip, TFile, View, type TAbstractFile, type WorkspaceLeaf } from "obsidian";
import { IMAGE_TYPES } from "src/constants/constants";
import type ExcalidrawPlugin from "src/core/main";
import { t } from "src/lang/helpers";
import { KIND_NAMES, VisualResourceGallery, visualResourceButton } from "src/shared/visualResources/VisualResourceGallery";
import { VisualResourceSettings } from "src/shared/visualResources/VisualResourceSettings";
import { drawingTarget, isDocumentTarget, writableDocument } from "src/shared/visualResources/VisualResourceTargets";
import { resourceInput, showResourceMenu, VisualResourceFilePrompt } from "src/shared/visualResources/resourceDialogs";
import { filterVisualResources, visualResourceKey, VISUAL_RESOURCE_FILTERS } from "src/shared/visualResources/visualResourceModel";
import type { VisualResource, VisualResourceFilter } from "src/types/visualResourceTypes";
import { setElementHidden } from "src/utils/htmlUtils";
import { errorlog } from "src/utils/coreUtils";
import { ExcalidrawSidepanelView } from "./Sidepanel";
import type { ExcalidrawSidepanelTab } from "./SidepanelTab";
import { VisualResourceMenus } from "./VisualResourceMenus";
import { VisualResourceSplit } from "./VisualResourceSplit";

type BrowserMode = { kind: "general" } | { kind: "icon"; scriptName: string };
const DEFAULT_FILTERS = VISUAL_RESOURCE_FILTERS.filter(key => key !== "other");

/** One resident native tab serves both Visual Resources and the Icon Library preset. */
export class VisualResourcePanel {
  private tab: ExcalidrawSidepanelTab | null = null;
  private opening: Promise<void> | null = null;
  private target: View | null = null;
  private mode: BrowserMode = { kind: "general" };
  private selection: Map<string, VisualResource> | null = null;
  private collection = "";
  private readonly collectionsByMode = new Map<string, string>();
  private library = "";
  private disposed = false;
  private revealing = 0;
  private refresh = () => {};
  private reload = () => {};
  private search: HTMLInputElement | null = null;
  private menu: Menu | null = null;
  private readonly menus: VisualResourceMenus;

  constructor(private readonly plugin: ExcalidrawPlugin) {
    this.menus = new VisualResourceMenus(plugin, () => this.reload(), () => this.target);
    plugin.register(() => { this.disposed = true; this.tab?.close(); });
  }

  private get service() { return this.plugin.visualResources; }
  private get preferences() { return this.plugin.settings.visualResources; }
  private get script() { return this.mode.kind === "icon" ? this.mode.scriptName : undefined; }
  private get availableFilters(): readonly VisualResourceFilter[] {
    return isDocumentTarget(this.target) ? VISUAL_RESOURCE_FILTERS.filter(key => key !== "stencil" && key !== "framework") : VISUAL_RESOURCE_FILTERS;
  }
  private get filters(): readonly VisualResourceFilter[] {
    return this.script ? ["icon"] : (this.preferences.filters ?? DEFAULT_FILTERS).filter(key => this.availableFilters.includes(key));
  }
  private get groups(): string[] | undefined {
    return this.script ? this.preferences.iconGroups?.[this.script] ?? this.service.iconSettings(this.script).groups : this.preferences.groups;
  }

  public openFromWorkspace(scriptName?: string): Promise<void> {
    const view = this.plugin.app.workspace.getMostRecentLeaf()?.view ?? null;
    return this.open(view instanceof ExcalidrawSidepanelView ? this.target : view, scriptName);
  }

  /** Open the one sidepanel tab and preserve the explicitly initiating editor across reveal. */
  public async open(view: View | null, scriptName?: string): Promise<void> {
    if (this.disposed) return;
    if (isDocumentTarget(this.target) !== isDocumentTarget(view)) this.selection = null;
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
    const toolbar = root.createDiv({ cls: "excalidraw-resource-toolbar excalidraw-resource-search-row" });
    const search = this.search = toolbar.createEl("input", { type: "search", placeholder: t("VR_SEARCH"), attr: { "aria-label": t("VR_SEARCH") } });
    const tools = toolbar.createDiv({ cls: "excalidraw-resource-toolbar excalidraw-resource-search-tools" });
    const filterHost = tools.createDiv({ cls: "excalidraw-resource-filter-host" });
    const filter = visualResourceButton(filterHost, "filter", t("VR_FILTER"));
    filter.setAttribute("aria-expanded", "false");
    const filtersEl = filterHost.createDiv({ cls: "excalidraw-resource-filter-popover", attr: { role: "group", "aria-label": t("VR_FILTER") } });
    setElementHidden(filtersEl, true);
    let filterDocument: Document | null = null;
    const closeFilters = (restoreFocus = false) => {
      filterDocument?.removeEventListener("pointerdown", outsideFilters, true);
      filterDocument = null;
      filter.setAttribute("aria-expanded", "false");
      setElementHidden(filtersEl, true);
      if (restoreFocus) filter.focus();
    };
    const outsideFilters = (event: PointerEvent) => {
      if (!event.composedPath().includes(filterHost)) closeFilters();
    };
    lifetime.register(closeFilters);
    lifetime.registerDomEvent(filtersEl, "keydown", event => {
      if (event.key === "Escape") { event.stopPropagation(); closeFilters(true); }
    });
    const collectionsIcon = ["square-library", "library-big"].find(icon => getIcon(icon)) ?? "library";
    const collections = visualResourceButton(tools, collectionsIcon, t("VR_COLLECTIONS"));
    const select = visualResourceButton(tools, "list-checks", t("VR_SELECT"), false);
    const layout = visualResourceButton(tools, "list", t("VR_LAYOUT"), this.preferences.list);
    const settings = visualResourceButton(tools, "settings", t("VR_SETTINGS"));
    const popout = Platform.isDesktopApp ? visualResourceButton(tools, "external-link", t("VR_POPOUT")) : null;
    for (const button of tools.querySelectorAll("button")) setTooltip(button, button.getAttribute("aria-label"));
    const status = root.createDiv({ cls: "excalidraw-resource-status", attr: { "aria-live": "polite" } });
    const selectionBar = root.createDiv({ cls: "excalidraw-resource-toolbar excalidraw-resource-selection" });
    const selectionCount = selectionBar.createSpan({ attr: { "aria-live": "polite" } });
    const selectionActions = selectionBar.createEl("button", { text: t("VR_SELECTED_ACTIONS"), attr: { type: "button" } });
    const panes = root.createDiv({ cls: "excalidraw-resource-panes" });
    const main = panes.createDiv({ cls: "excalidraw-resource-main" });
    main.id = tab.id + "-gallery";
    const details = panes.createDiv({ cls: "excalidraw-resource-frames" });
    const split = lifetime.addChild(new VisualResourceSplit(panes, main, details, Platform.isMobile ? 25 : 50));
    const heading = details.createDiv({ cls: "excalidraw-resource-toolbar" });
    const back = visualResourceButton(heading, "chevron-left", t("VR_BACK"));
    const parent = heading.createSpan();
    let selectedParent: VisualResource | null = null;
    let frames: VisualResource[] = [], data: VisualResource[] = [], curatedFrames: VisualResource[] = [];
    let results: VisualResource[] = [], queryContext = "";
    const renamePositions = new Map<string, number>();
    let load = 0, frameLoad = 0, closed = false, loading = true;
    const open = (resource: VisualResource): void => { void this.service.openSource(resource).catch(() => this.failed()); };
    const closeFrames = () => { frameLoad++; selectedParent = null; frames = []; refresh(false); };
    const updateSelectionBar = () => {
      const selecting = this.selection !== null;
      select.setAttribute("aria-pressed", String(selecting));
      const label = t(selecting ? "VR_EXIT_SELECTION" : "VR_SELECT");
      if (select.getAttribute("aria-label") !== label) {
        select.setAttribute("aria-label", label);
        setTooltip(select, label);
      }
      setElementHidden(selectionBar, !selecting);
      const count = this.selection?.size ?? 0;
      selectionCount.setText(t("VR_SELECTION_COUNT").replace("{COUNT}", String(count)));
      selectionActions.disabled = count === 0;
    };
    const toggleSelection = () => {
      gallery.cancelClick(); childGallery.cancelClick();
      this.service.endDrag();
      this.selection = this.selection ? null : new Map<string, VisualResource>();
      refresh(false);
    };
    const activate = (resource: VisualResource) => {
      if (this.selection) {
        const key = visualResourceKey(resource.locator);
        if (this.selection.has(key)) this.selection.delete(key); else this.selection.set(key, resource);
        gallery.updateSelection();
        childGallery.updateSelection();
        updateSelectionBar();
        return;
      }
      const target = this.target;
      const file = target?.file;
      void this.service.insertInto(resource, target, () => this.tab === tab && this.target === target && target?.file === file, this.script);
    };
    const rename = async (resource: VisualResource, name: string) => {
      const { locator } = resource;
      if (locator.provider !== "stencil" || name === resource.title) return;
      const key = visualResourceKey(locator);
      const index = results.findIndex(item => visualResourceKey(item.locator) === key);
      if (index >= 0 && !renamePositions.has(key)) renamePositions.set(key, index);
      try {
        await this.plugin.stencilLibraryManager.renameResourceStencil(locator.path, locator.id, name);
        if (closed) return;
        data = data.map(item => visualResourceKey(item.locator) === key ? { ...item, title: name } : item)
          .sort((left, right) => left.title.localeCompare(right.title));
        refresh(false);
      } catch {
        if (!closed) this.failed();
      }
    };
    const actions = {
      activate, open,
      deferredActivation: (resource: VisualResource) => {
        const target = this.target, api = drawingTarget(target)?.excalidrawAPI, file = target?.file, mode = this.mode;
        return () => {
          if (this.target === target && drawingTarget(target)?.excalidrawAPI === api && target?.file === file && this.mode === mode && !this.selection) activate(resource);
        };
      },
      canActivate: (resource: VisualResource) => !!this.selection || this.service.canInsertInto(resource, this.target),
      favorite: (resource: VisualResource) => this.run(this.service.collections.curate([resource.locator], {
        favorite: !this.service.collections.state(resource.locator).favorite,
      })),
      menu: (resource: VisualResource, el: HTMLElement, event: MouseEvent) => this.show(this.menus.resource(resource, this.collection,
        () => this.tab === tab, name => {
          el.focus({ preventScroll: true });
          void rename(resource, name);
        }), el, event),
      rename: (resource: VisualResource, name: string) => { void rename(resource, name); },
      frames: (resource: VisualResource) => {
        if (selectedParent && visualResourceKey(selectedParent.locator) === visualResourceKey(resource.locator)) { closeFrames(); return; }
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
      frameCount: (resource: VisualResource) => {
        if (!this.filters.includes("drawing")) return null;
        return resource.frames?.length ?? 0;
      },
      frameSelected: (resource: VisualResource) => !!selectedParent && visualResourceKey(selectedParent.locator) === visualResourceKey(resource.locator),
      pageChanged: () => { if (selectedParent) refresh(false); },
      drag: (resource: VisualResource, transfer: DataTransfer) => this.service.startDrag(transfer, resource),
      escape: () => {
        if (this.selection) { toggleSelection(); select.focus(); }
        else if (selectedParent) closeFrames();
        else tab.close();
      },
      selected: (resource: VisualResource) => this.selection?.has(visualResourceKey(resource.locator)),
    };
    const gallery = lifetime.addChild(new VisualResourceGallery(main, this.service, actions));
    const childGallery = lifetime.addChild(new VisualResourceGallery(details, this.service, actions));
    const refresh = (reset = true) => {
      const scroll = main.scrollTop;
      const group = this.collection;
      const context = JSON.stringify([this.script, group, this.library, search.value, this.filters, this.groups, this.preferences.hasNamedFrames]);
      if (context !== queryContext) {
        renamePositions.clear();
        queryContext = context;
      }
      const candidates = group ? [...data, ...curatedFrames].filter(resource => {
        const record = this.service.collections.state(resource.locator);
        return group === "favorites" ? record.favorite : record.memberships.includes(group);
      }) : data;
      const libraryMatches = candidates.filter(resource =>
        !this.library || resource.locator.provider !== "stencil" || resource.locator.path === this.library);
      results = filterVisualResources(libraryMatches, search.value, this.filters, this.groups, this.preferences.hasNamedFrames);
      if (renamePositions.size) {
        const retained = filterVisualResources(libraryMatches.filter(item => renamePositions.has(visualResourceKey(item.locator))),
          "", this.filters, this.groups, this.preferences.hasNamedFrames).map(item => ({ item, index: renamePositions.get(visualResourceKey(item.locator)) }));
        results = results.filter(item => !renamePositions.has(visualResourceKey(item.locator)));
        for (const { item, index } of retained.sort((left, right) => left.index - right.index)) results.splice(index, 0, item);
      }
      const old = this.service.iconSettings(this.script);
      const dark = root.ownerDocument.body.hasClass("theme-dark");
      const background = dark ? this.preferences.darkBackground ?? old.darkBackground : this.preferences.lightBackground ?? old.lightBackground;
      const options = { list: this.preferences.list, size: this.preferences.thumbnailSize ?? old.thumbnailSize, background };
      const drawing = this.service.writable(drawingTarget(this.target));
      status.setText(loading ? t("VR_LOADING") : drawing ? "" : writableDocument(this.target)
        ? t("VR_INSERT_TARGET").replace("{TITLE}", this.target.file.basename) : t("VR_NO_DRAWING"));
      updateSelectionBar();
      gallery.show(results, options, reset);
      if (selectedParent && !gallery.shows(selectedParent)) {
        frameLoad++;
        selectedParent = null;
        frames = [];
      }
      const showingFrames = !!selectedParent && this.filters.includes("drawing");
      split.showFrames(showingFrames);
      if (showingFrames) {
        parent.setText(selectedParent.title);
      }
      childGallery.show(showingFrames ? frames : [], { ...options, list: true }, reset);
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
      void Promise.all([this.service.list(this.script, data.length ? undefined : progressive), this.collection ? this.service.curatedFrames() : []]).then(([resources, curated]) => {
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
      if (this.revealing || leaf === panel.leaf ||
          root.contains(root.ownerDocument.activeElement) && leaf !== this.target?.leaf) return;
      if (this.plugin.app.workspace.getActiveViewOfType(View) !== leaf?.view) return;
      const view = leaf?.view ?? null;
      if (view === this.target) return;
      if (isDocumentTarget(this.target) !== isDocumentTarget(view)) this.selection = null;
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
    lifetime.registerEvent(this.plugin.app.workspace.on("file-open", () => {
      const recent = this.plugin.app.workspace.getMostRecentLeaf();
      if (recent === this.target?.leaf) followLeaf(recent);
      this.refresh();
    }));
    tab.onWindowMigrated = () => {
      closeFilters();
      gallery.closeHoverPreview();
      childGallery.closeHoverPreview();
      split.cancelDrag(); this.service.endDrag(); cancelScheduled(); gallery.cancelClick(); childGallery.cancelClick(); refresh(false);
    };
    tab.onFocus = () => this.refresh();
    tab.onExcalidrawViewClosed = () => { if (drawingTarget(this.target)) { this.target = null; this.refresh(); } };
    back.onclick = closeFrames;
    search.oninput = () => { gallery.cancelClick(); childGallery.cancelClick(); refresh(); };
    search.onkeydown = event => {
      if (event.key === "ArrowDown") { event.preventDefault(); gallery.focusFirst(); }
      if (event.key === "Escape") actions.escape();
    };
    filter.onclick = () => {
      if (filterDocument) { closeFilters(); return; }
      this.menu?.hide();
      filterDocument = filter.ownerDocument;
      filterDocument.addEventListener("pointerdown", outsideFilters, true);
      filter.setAttribute("aria-expanded", "true");
      setElementHidden(filtersEl, false);
      void this.filterMenu(filtersEl, () => refresh(), () => closeFilters(true)).catch(() => this.failed());
    };
    collections.onclick = () => this.show(this.collectionsMenu(), collections);
    if (popout) popout.onclick = () => {
      const docked = root.ownerDocument === this.plugin.app.workspace.containerEl.ownerDocument;
      ExcalidrawSidepanelView.applyLocationPreference(this.plugin, docked);
      void panel.reveal();
    };
    settings.onclick = () => new VisualResourceSettings(this.plugin, reload, this.script).open();
    layout.onclick = () => {
      this.preferences.list = !this.preferences.list;
      layout.setAttribute("aria-pressed", String(this.preferences.list));
      this.run(this.plugin.saveSettings());
      refresh(false);
    };
    select.onclick = toggleSelection;
    selectionActions.onclick = () => {
      if (this.selection?.size) this.show(this.menus.selection([...this.selection.values()], this.collection, () => this.tab === tab, this.script), selectionActions);
    };
    refresh();
    void this.service.collections.refresh().catch(() => this.failed());
    reload();
  }

  private async filterMenu(popover: HTMLElement, refresh: () => void, close: () => void): Promise<void> {
    const script = this.script;
    const rules = this.service.rules(script);
    const paths = !script && this.availableFilters.includes("stencil")
      ? (await this.plugin.stencilLibraryManager.getResourceLibraries()).paths : [];
    if (!popover.isConnected || this.script !== script || popover.hasClass("excalidraw-display-none")) return;
    const allGroups = [...rules.icon.map(rule => "icon:" + rule.name), ...rules.drawing.map(rule => "drawing:" + rule.name)];
    const setGroups = (next: string[]) => {
      if (script) (this.preferences.iconGroups ??= {})[script] = next;
      else this.preferences.groups = next;
    };
    const save = () => { this.run(this.plugin.saveSettings()); refresh(); draw(); };
    const setTypes = (visible: readonly VisualResourceFilter[]) => {
      const hidden = (this.preferences.filters ?? DEFAULT_FILTERS).filter(key => !this.availableFilters.includes(key));
      this.preferences.filters = [...hidden, ...visible];
      save();
    };
    const draw = () => {
      const focus = popover.ownerDocument.activeElement?.getAttribute("data-filter");
      const scroll = popover.scrollTop;
      popover.empty();
      const actions = popover.createDiv({ cls: "excalidraw-resource-filter-actions" });
      const button = (parent: HTMLElement, name: string, key: string, action: () => void) => {
        parent.createEl("button", { text: name, attr: { type: "button", "data-filter": key } }).onclick = action;
      };
      const check = (parent: HTMLElement, name: string, key: string, checked: boolean, action: (value: boolean) => void) => {
        const label = parent.createEl("label", { cls: "excalidraw-resource-filter-option" });
        const input = label.createEl("input", { type: "checkbox", attr: { "data-filter": key } });
        input.checked = checked;
        input.onchange = () => action(input.checked);
        label.createSpan({ text: name });
        return label;
      };
      if (!script) {
        button(actions, t("VR_SELECT_ALL_FILTERS"), "all", () => setTypes(this.availableFilters));
        button(actions, t("VR_SELECT_NO_FILTERS"), "none", () => setTypes([]));
      }
      button(actions, t("VR_FILTER_DONE"), "done", close);
      const types = popover.createDiv();
      if (!script) for (const key of this.availableFilters) {
        check(types, t(KIND_NAMES[key]), key, this.filters.includes(key), checked =>
          setTypes(checked ? [...this.filters, key] : this.filters.filter(filter => filter !== key)));
      }
      if (this.filters.includes("drawing")) {
        const row = check(types, t("VR_HAS_NAMED_FRAMES"), "has-named-frames", !!this.preferences.hasNamedFrames, checked => {
          this.preferences.hasNamedFrames = checked;
          save();
        });
        setTooltip(row, t("VR_HAS_NAMED_FRAMES_DESC"));
        row.createSpan({ cls: "excalidraw-resource-filter-hint", text: t("VR_HAS_NAMED_FRAMES_DESC") });
      }
      for (const [kind, label] of [["icon", "VR_ICON_GROUPS"], ["drawing", "VR_DRAWING_GROUPS"]] as const) {
        if (!this.filters.includes(kind) || !rules[kind].length) continue;
        const section = popover.createDiv({ cls: "excalidraw-resource-filter-section" });
        section.createEl("h4", { text: t(label) });
        for (const { name } of rules[kind]) {
          const key = kind + ":" + name;
          check(section, name, key, this.groups?.includes(key) ?? true, checked => {
            const current = this.groups ?? allGroups;
            setGroups(checked ? [...current, key] : current.filter(group => group !== key));
            save();
          });
        }
      }
      if (!script && this.filters.includes("stencil")) {
        const section = popover.createDiv({ cls: "excalidraw-resource-filter-section" });
        const label = section.createEl("label");
        label.createSpan({ text: t("VR_STENCIL_LIBRARIES") });
        const library = label.createEl("select", { attr: { "data-filter": "library" } });
        for (const path of ["", ...paths]) library.createEl("option", { value: path, text: path || t("VR_ALL_LIBRARIES") });
        library.value = this.library;
        library.onchange = () => { this.library = library.value; refresh(); };
        button(section, t("VR_MANAGE_LIBRARIES"), "manage", () => { close(); this.run(this.menus.manage()); });
      }
      if (focus) [...popover.querySelectorAll<HTMLElement>("[data-filter]")]
        .find(control => control.getAttribute("data-filter") === focus)?.focus({ preventScroll: true });
      popover.scrollTop = scroll;
    };
    draw();
    popover.querySelector<HTMLElement>("[data-filter]")?.focus();
  }

  private collectionsMenu(): Menu {
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
