import { Component, normalizePath, type TFile } from "obsidian";
import type ExcalidrawPlugin from "src/core/main";
import type { VisualResourceLocator } from "src/types/visualResourceTypes";
import { visualResourceKey } from "./visualResourceModel";

interface CollectionResource {
  locator: VisualResourceLocator;
  favorite?: boolean;
  manual?: boolean;
  missing?: boolean;
}

interface Playlist {
  name: string;
  parent?: string;
  members: string[];
}

interface CollectionFile {
  version: 1;
  resources: Record<string, CollectionResource>;
  playlists: Record<string, Playlist>;
}

const empty = (): CollectionFile => ({ version: 1, resources: {}, playlists: {} });

function isLocator(value: unknown): value is VisualResourceLocator {
  if (!value || typeof value !== "object") return false;
  const locator = value as Record<string, unknown>;
  return locator.provider === "lucide" && typeof locator.icon === "string" ||
    locator.provider === "vault" && typeof locator.path === "string" &&
      (locator.frame === undefined || typeof locator.frame === "string") ||
    locator.provider === "stencil" && typeof locator.id === "string" &&
      (locator.path === undefined || typeof locator.path === "string") ||
    locator.provider === "framework" && typeof locator.path === "string" && typeof locator.id === "string";
}

/** Validate the synced file and repair dangling references without guessing identities. */
export function readResourceCollections(raw: string): CollectionFile {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") throw Error("Invalid resource collections");
  const data = parsed as Partial<CollectionFile>;
  if (data.version !== 1 || !data.resources || !data.playlists ||
      typeof data.resources !== "object" || typeof data.playlists !== "object" ||
      Array.isArray(data.resources) || Array.isArray(data.playlists)) throw Error("Unsupported resource collections");
  const resources = Object.fromEntries(Object.entries(data.resources).filter(([, resource]) => resource && isLocator(resource.locator)));
  const playlists = Object.fromEntries(Object.entries(data.playlists).flatMap(([id, list]) => {
    if (!list || typeof list.name !== "string" || !Array.isArray(list.members)) return [];
    const parent = typeof list.parent === "string" ? list.parent : undefined;
    return [[id, { name: list.name, parent, members: [...new Set(list.members)].filter(key => Object.hasOwn(resources, key)) }]];
  }));
  for (const [id, list] of Object.entries(playlists)) {
    const seen = new Set([id]);
    let parent = list.parent;
    while (parent) {
      if (!Object.hasOwn(playlists, parent) || seen.has(parent)) { delete list.parent; break; }
      seen.add(parent);
      parent = playlists[parent].parent;
    }
  }
  return { version: 1, resources, playlists };
}

function findResource(data: CollectionFile, locator: VisualResourceLocator): string | undefined {
  const key = visualResourceKey(locator);
  const records = Object.entries(data.resources);
  if (locator.provider === "stencil") {
    const exact = records.find(([, resource]) => resource.locator.provider === "stencil" &&
      !resource.missing && resource.locator.id === locator.id && resource.locator.path === locator.path);
    return exact?.[0];
  }
  return records.find(([, resource]) => !resource.missing && visualResourceKey(resource.locator) === key)?.[0];
}

type CollectionEdit = (data: CollectionFile) => void;
type ScheduledEdit = { edit: CollectionEdit; create: boolean; resolve: () => void; reject: (error: unknown) => void };

/** Owns the vault's normalized curation file. Writes replay against the latest vault revision. */
export class ResourceCollections extends Component {
  private data = empty();
  private loadedPath = "";
  private revision = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  private stateIndex = new Map<string, { favorite: boolean; memberships: string[] }>();
  private scheduled = new Map<string, ScheduledEdit[]>();

  constructor(private readonly plugin: ExcalidrawPlugin) {
    super();
  }

  private get path() { return normalizePath(this.plugin.settings.folder + "/resource-collections.json"); }

  /** Observe external sync and update paths for known vault renames and deletions. */
  public onload(): void {
    const vault = this.plugin.app.vault;
    const refresh = () => { void this.refresh().catch(() => this.notify()); };
    this.registerEvent(vault.on("modify", file => { if (file.path === this.path) refresh(); }));
    this.registerEvent(vault.on("create", file => { if (file.path === this.path) refresh(); }));
    this.registerEvent(vault.on("delete", file => {
      if (file.path === this.path) refresh();
      else this.relocate(file.path);
    }));
    this.registerEvent(vault.on("rename", (file, oldPath) => {
      if (oldPath === this.loadedPath || file.path === this.path) refresh();
      this.relocate(oldPath, file.path);
    }));
  }

  private notify(): void { this.listeners.forEach(listener => listener()); }

  /** Subscribe to refreshed local and external curation. */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Reload when opening the gallery, including changes made while the plugin was inactive. */
  public async refresh(): Promise<void> {
    const path = this.path;
    const revision = ++this.revision;
    const file = this.plugin.app.vault.getFileByPath(path);
    const data = file ? readResourceCollections(await this.plugin.app.vault.read(file)) : empty();
    if (path !== this.path || revision !== this.revision) return;
    this.loadedPath = path;
    this.data = data;
    const playlists = new Map<string, string[]>();
    for (const [id, playlist] of this.playlists) for (const member of playlist.members) {
      const memberships = playlists.get(member) ?? [];
      memberships.push(id);
      playlists.set(member, memberships);
    }
    this.stateIndex.clear();
    for (const [id, resource] of Object.entries(data.resources)) if (!resource.missing) {
      this.stateIndex.set(this.stateKey(resource.locator), { favorite: !!resource.favorite, memberships: playlists.get(id) ?? [] });
    }
    this.notify();
  }

  /** Playlists in display order, with parent IDs and membership counts. */
  public get playlists() { return Object.entries(this.data.playlists); }

  /** Resolvable curated locators. Confirmed deletions remain recorded for repair. */
  public get curated() { return Object.values(this.data.resources).filter(resource => !resource.missing); }

  /** Return the favorite and membership state of a resource. */
  public state(locator: VisualResourceLocator) {
    return this.stateIndex.get(this.stateKey(locator)) ?? { favorite: false, memberships: [] };
  }

  private stateKey(locator: VisualResourceLocator): string {
    return locator.provider === "stencil" ? JSON.stringify([locator.provider, locator.id, locator.path]) : visualResourceKey(locator);
  }

  /** Apply one explicit user intent to one or more resources together. */
  public curate(locators: VisualResourceLocator[], options: { favorite?: boolean; manual?: boolean; playlist?: string; member?: boolean }): Promise<void> {
    return this.edit(data => {
      for (const locator of locators) {
        let id = findResource(data, locator);
        if (!id) {
          if (!options.favorite && !options.manual && !options.member) continue;
          id = this.id();
          data.resources[id] = { locator };
        }
        const resource = data.resources[id];
        if (options.favorite !== undefined) resource.favorite = options.favorite || undefined;
        if (options.manual !== undefined) resource.manual = options.manual || undefined;
        const list = options.playlist && data.playlists[options.playlist];
        if (list) {
          list.members = list.members.filter(member => member !== id);
          if (options.member) list.members.push(id);
        }
        if (!resource.favorite && !resource.manual && !Object.values(data.playlists).some(entry => entry.members.includes(id))) delete data.resources[id];
      }
    });
  }

  /** Create or rename a playlist under its chosen parent. */
  public savePlaylist(name: string, id = this.id(), parent?: string): Promise<void> {
    return this.edit(data => {
      if (!name.trim() || parent && !Object.hasOwn(data.playlists, parent)) return;
      let ancestor = parent;
      while (ancestor) {
        if (ancestor === id) return;
        ancestor = data.playlists[ancestor]?.parent;
      }
      data.playlists[id] = { name: name.trim(), parent, members: data.playlists[id]?.members ?? [] };
    });
  }

  /** Remove the playlist after its child playlists have been removed. */
  public removePlaylist(id: string): Promise<void> {
    return this.edit(data => {
      if (!Object.hasOwn(data.playlists, id)) return;
      if (Object.values(data.playlists).some(playlist => playlist.parent === id)) throw Error("Playlist contains children");
      const { members } = data.playlists[id];
      delete data.playlists[id];
      for (const member of members) {
        const resource = data.resources[member];
        if (resource && !resource.favorite && !resource.manual && !Object.values(data.playlists).some(list => list.members.includes(member))) delete data.resources[member];
      }
    });
  }

  /** Update a stencil's library locator after an ownership-validated move. */
  public moveStencils(ids: readonly string[], source: string, destination: string): Promise<void> {
    const moving = new Set(ids);
    return this.edit(data => {
      for (const entry of Object.values(data.resources)) {
        const locator = entry.locator;
        if (locator.provider !== "stencil" || locator.path !== source || !moving.has(locator.id)) continue;
        locator.path = destination;
        delete entry.missing;
      }
    }, false);
  }

  private id(): string {
    return this.plugin.app.workspace.containerEl.ownerDocument.defaultView.crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }

  private relocate(from: string, to?: string): void {
    void this.edit(data => {
      for (const record of Object.values(data.resources)) {
        const locator = record.locator;
        if (!("path" in locator) || !locator.path || record.missing) continue;
        if (locator.path !== from && !locator.path.startsWith(from + "/")) continue;
        if (to) locator.path = to + locator.path.slice(from.length);
        else record.missing = true;
      }
    }, false).catch(() => this.notify());
  }

  private edit(edit: CollectionEdit, create = true): Promise<void> {
    const path = this.path;
    return new Promise((resolve, reject) => {
      const active = this.scheduled.get(path);
      if (active) { active.push({ edit, create, resolve, reject }); return; }
      const edits = [{ edit, create, resolve, reject }];
      this.scheduled.set(path, edits);
      const run = this.queue.then(() => {
        this.scheduled.delete(path);
        return this.write(path, edits);
      });
      this.queue = run.catch(() => {});
      void run.then(() => edits.forEach(edit => edit.resolve()), error => edits.forEach(edit => edit.reject(error)));
    });
  }

  private async write(path: string, edits: ScheduledEdit[]): Promise<void> {
    if (path !== this.path) throw Error("Resource collections folder changed");
    const vault = this.plugin.app.vault;
    const apply = (raw: string | null) => {
      const data = raw === null ? empty() : readResourceCollections(raw);
      const before = JSON.stringify(data);
      for (const entry of edits) entry.edit(data);
      const after = JSON.stringify(data);
      return before === after ? raw : after + "\n";
    };
    let file: TFile | null = vault.getFileByPath(path);
    if (!file && edits.some(entry => entry.create)) {
      const content = apply(null);
      if (content === null) return;
      const slash = path.lastIndexOf("/");
      const folder = slash < 0 ? "" : path.slice(0, slash);
      if (folder && !vault.getFolderByPath(folder)) await vault.createFolder(folder);
      if (path !== this.path) throw Error("Resource collections folder changed");
      file = vault.getFileByPath(path);
      if (!file) {
        try { await vault.create(path, content); }
        catch (error) {
          file = vault.getFileByPath(path);
          if (!file) throw error;
        }
      }
    }
    if (file) await vault.process(file, raw => apply(raw) ?? raw);
    await this.refresh();
  }
}
