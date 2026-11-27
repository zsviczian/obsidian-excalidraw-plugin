import { Menu, Modal, Notice, Setting, SuggestModal, type TFile } from "obsidian";
import type ExcalidrawPlugin from "src/core/main";
import { t } from "src/lang/helpers";
import { KIND_NAMES } from "src/shared/visualResources/VisualResourceGallery";
import { resourceInput } from "src/shared/visualResources/resourceDialogs";
import type { VisualResource } from "src/types/visualResourceTypes";
import type ExcalidrawView from "../ExcalidrawView";

type LibrarySnapshot = Awaited<ReturnType<ExcalidrawPlugin["stencilLibraryManager"]["getResourceLibraries"]>>;

/** Native action menus shared by cards, list rows, frames, and multi-selection. */
export class VisualResourceMenus {
  constructor(private readonly plugin: ExcalidrawPlugin, private readonly refresh: () => void,
    private readonly target: () => ExcalidrawView | null, private readonly svgSource: () => boolean) {}

  private get service() { return this.plugin.visualResources; }

  /** Include ancestry so identically named playlists remain distinguishable. */
  public playlistName(id: string): string {
    const lists = new Map(this.service.collections.playlists);
    const names: string[] = [];
    for (let list = lists.get(id); list; list = list.parent ? lists.get(list.parent) : undefined) names.unshift(list.name);
    return names.join(" / ");
  }

  /** Construct a resource's applicable actions using its live capability checks. */
  public resource(resource: VisualResource, collection: string, panelOpen: () => boolean, toggleSvgSource: (value: boolean) => void): Menu {
    const menu = new Menu();
    const view = this.target();
    const active = () => panelOpen() && this.target() === view;
    const source = this.service.sourceFile(resource);
    const svg = resource.locator.provider === "vault" && source?.extension.toLowerCase() === "svg";
    menu.addItem(item => item.setTitle(t("VR_RESOURCE_INFO")).setIcon("info").onClick(() => {
      const modal = new Modal(this.plugin.app);
      modal.setTitle(resource.title);
      modal.contentEl.createEl("p", { text: t(KIND_NAMES[resource.locator.provider === "lucide" ? "lucide" : resource.kind]) });
      if (resource.source) modal.contentEl.createEl("p", { text: resource.source });
      modal.open();
    }));
    menu.addItem(item => item.setTitle(t(svg ? "VR_INSERT_SVG" : "VR_INSERT")).setIcon("plus").setDisabled(!this.service.writable(view))
      .onClick(() => this.run(this.service.insert(resource, view, active))));
    if (svg) {
      menu.addItem(item => item.setTitle(t("VR_INSERT_STROKES")).setIcon("pen-tool").setDisabled(!this.service.writable(view))
        .onClick(() => this.run(this.service.insertSvgStrokes(resource, view, active, this.svgSource()))));
      if (view?.file.extension === "md") menu.addItem(item => item.setTitle(t("VR_SVG_RETAIN_LINK"))
        .setChecked(this.svgSource()).onClick(() => toggleSvgSource(!this.svgSource())));
    }
    if (resource.locator.provider === "vault" && source) menu.addItem(item =>
      item.setTitle(t("VR_OPEN_SOURCE")).setIcon("file-up").onClick(() => this.run(this.service.openSource(resource))));
    if (source) this.addReveal(menu, resource, source);
    menu.addSeparator();
    const record = this.service.collections.state(resource.locator);
    menu.addItem(item => item.setTitle(t(record.favorite ? "VR_UNFAVORITE" : "VR_FAVORITE")).setIcon("bookmark").onClick(() =>
      this.run(this.service.collections.curate([resource.locator], { favorite: !record.favorite }))));
    this.addMembershipActions(menu, [resource], collection);
    if (resource.locator.provider === "stencil") {
      menu.addSeparator();
      menu.addItem(item => item.setTitle(t("VR_RENAME")).setIcon("pencil").onClick(() => {
        this.run(resourceInput(this.plugin.app, t("VR_RENAME"), { value: resource.title }).then(name => {
          if (name) return this.renameStencil(resource, name);
        }));
      }));
      menu.addItem(item => item.setTitle(t("VR_MOVE_LIBRARY")).onClick(() => this.run(this.move([resource]))));
      menu.addItem(item => item.setTitle(t("VR_MANAGE_LIBRARIES")).onClick(() => this.run(this.manage())));
    }
    return menu;
  }

  /** Persist either editor's change in the stencil's owning library. */
  public async renameStencil(resource: VisualResource, name: string): Promise<void> {
    const { locator } = resource;
    if (locator.provider !== "stencil" || name === resource.title) return;
    await this.plugin.stencilLibraryManager.renameResourceStencil(locator.path, locator.id, name);
    this.refresh();
  }

  /** Bulk memberships support mixed resources. Library moves use selected stencils only. */
  public selection(selection: VisualResource[], collection: string): Menu {
    const menu = new Menu();
    this.addMembershipActions(menu, selection, collection);
    const stencils = selection.filter(resource => resource.locator.provider === "stencil");
    if (stencils.length) menu.addItem(item => item.setTitle(t("VR_MOVE_LIBRARY")).onClick(() => this.run(this.move(stencils))));
    return menu;
  }

  private addMembershipActions(menu: Menu, resources: VisualResource[], collection: string): void {
    const store = this.service.collections;
    const lists = store.playlists;
    const locators = resources.map(resource => resource.locator);
    if (lists.some(([id]) => id === collection)) menu.addItem(item => item.setTitle(t("VR_REMOVE_CURRENT"))
      .onClick(() => this.run(store.curate(locators, { playlist: collection, member: false }))));
    for (const [id] of lists) {
      const member = locators.every(locator => store.state(locator).memberships.includes(id));
      menu.addItem(item => item.setTitle(this.playlistName(id)).setChecked(member)
        .onClick(() => this.run(store.curate(locators, { playlist: id, member: !member }))));
    }
  }

  private addReveal(menu: Menu, resource: VisualResource, file: TFile): void {
    const vaultResource = resource.locator.provider === "vault";
    const leaf = this.plugin.app.workspace.getLeavesOfType("file-explorer")[0];
    const view = leaf?.view as { revealInFolder?: (file: TFile) => void };
    if (view?.revealInFolder) menu.addItem(item => item.setTitle(t(vaultResource ? "VR_REVEAL" : "VR_REVEAL_LIBRARY"))
      .onClick(() => this.run(this.plugin.app.workspace.revealLeaf(leaf).then(() => view.revealInFolder?.(file)))));
    const system = this.service.revealSystem(resource);
    if (system) menu.addItem(item => item.setTitle(t(vaultResource ? "VR_REVEAL_SYSTEM" : "VR_REVEAL_LIBRARY_SYSTEM")).onClick(system));
  }

  /** Manage actual stencil libraries, including empty destinations. */
  public async manage(): Promise<void> {
    const snapshot = await this.plugin.stencilLibraryManager.getResourceLibraries();
    if (!snapshot.defaultPath) { this.legacy(); return; }
    const modal = new Modal(this.plugin.app);
    modal.setTitle(t("VR_MANAGE_LIBRARIES"));
    for (const path of snapshot.paths) {
      const count = snapshot.items.filter(entry => entry.path === path).length;
      new Setting(modal.contentEl).setName(this.libraryName(path, snapshot)).setDesc(String(count))
        .addExtraButton(button => button.setIcon("trash").setTooltip(t("VR_DELETE_LIBRARY")).onClick(() => {
          modal.close();
          this.run(this.deleteLibrary(path, snapshot));
        }));
    }
    new Setting(modal.contentEl).addButton(button => button.setCta().setButtonText(t("VR_CREATE_LIBRARY")).onClick(() => {
      this.run(this.createLibrary().then(path => { if (path) { modal.close(); return this.manage(); } }));
    }));
    modal.open();
  }

  private legacy(): void {
    const modal = new Modal(this.plugin.app);
    modal.setTitle(t("VR_MANAGE_LIBRARIES"));
    modal.contentEl.createEl("p", { text: t("VR_LEGACY_LIBRARY") });
    new Setting(modal.contentEl).addButton(button => button.setButtonText(t("VR_LIBRARY_STORAGE")).onClick(() => {
      modal.close();
      this.plugin.app.setting.open();
      this.plugin.app.setting.openTabById(this.plugin.manifest.id);
    }));
    modal.open();
  }

  private libraryName(path: string, snapshot: LibrarySnapshot): string {
    const name = path.slice(path.lastIndexOf("/") + 1);
    return path === snapshot.defaultPath ? name + " · " + t("VR_DEFAULT_LIBRARY") : name;
  }

  private async createLibrary(): Promise<string | null> {
    const name = await resourceInput(this.plugin.app, t("VR_CREATE_LIBRARY"), { value: "" });
    return name ? this.plugin.stencilLibraryManager.createResourceLibrary(name) : null;
  }

  private async move(resources: VisualResource[]): Promise<void> {
    const snapshot = await this.plugin.stencilLibraryManager.getResourceLibraries();
    if (!snapshot.defaultPath) { this.legacy(); return; }
    const sources = new Map<string, string[]>();
    for (const { locator } of resources) {
      if (locator.provider !== "stencil" || !locator.path) continue;
      const ids = sources.get(locator.path) ?? [];
      ids.push(locator.id);
      sources.set(locator.path, ids);
    }
    const destination = await this.chooseLibrary(snapshot, sources.size === 1 ? [...sources.keys()][0] : undefined);
    if (!destination) return;
    for (const [source, ids] of sources) {
      if (source === destination) continue;
      await this.plugin.stencilLibraryManager.moveResourceStencils(source, destination, ids);
      await this.service.collections.moveStencils(ids, source, destination);
    }
  }

  private chooseLibrary(snapshot: LibrarySnapshot, source?: string): Promise<string | null> {
    return new Promise(resolve => {
      let chosen = false;
      const entries = snapshot.paths.map(path => ({ path, name: this.libraryName(path, snapshot) + (path === source ? " ✓" : "") }));
      entries.push({ path: "", name: t("VR_CREATE_LIBRARY") });
      const create = () => this.createLibrary();
      const modal = new class extends SuggestModal<{ path: string; name: string }> {
        public getSuggestions(query: string) { return entries.filter(item => item.name.toLowerCase().includes(query.toLowerCase())); }
        public renderSuggestion(item: { name: string }, el: HTMLElement) { el.setText(item.name); }
        public selectSuggestion(item: { path: string; name: string }, event: MouseEvent | KeyboardEvent) {
          chosen = true;
          super.selectSuggestion(item, event);
        }
        public onChooseSuggestion(item: { path: string }) {
          if (item.path) resolve(item.path);
          else void create().then(resolve).catch(() => { new Notice(t("VR_ACTION_FAILED")); resolve(null); });
        }
        public onClose() { super.onClose(); if (!chosen) resolve(null); }
      }(this.plugin.app);
      modal.setPlaceholder(t("VR_MOVE_LIBRARY"));
      modal.open();
    });
  }

  private async deleteLibrary(path: string, snapshot: LibrarySnapshot): Promise<void> {
    const items = snapshot.items.filter(entry => entry.path === path).map(entry => entry.item.id);
    const action = await new Promise<"move" | "delete" | null>(resolve => {
      const modal = new Modal(this.plugin.app);
      modal.setTitle(t("VR_DELETE_LIBRARY"));
      new Setting(modal.contentEl).setName(this.libraryName(path, snapshot)).setDesc(String(items.length))
        .addButton(button => button.setWarning().setButtonText(t("VR_DELETE")).onClick(() => { resolve("delete"); modal.close(); }));
      if (items.length) new Setting(modal.contentEl).addButton(button => button.setButtonText(t("VR_MOVE_AND_DELETE"))
        .onClick(() => { resolve("move"); modal.close(); }));
      modal.onClose = () => resolve(null);
      modal.open();
    });
    if (!action) return;
    const destination = action === "move" ? await this.chooseLibrary(snapshot, path) : null;
    if (action === "move" && (!destination || destination === path)) return;
    await this.plugin.stencilLibraryManager.deleteResourceLibrary(path, destination, items);
    if (destination) await this.service.collections.moveStencils(items, path, destination);
  }

  private run(promise: Promise<unknown>): void {
    void promise.then(this.refresh).catch(() => { this.refresh(); new Notice(t("VR_ACTION_FAILED")); });
  }
}
