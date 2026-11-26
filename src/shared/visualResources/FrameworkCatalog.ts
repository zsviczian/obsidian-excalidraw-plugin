import { Modal, Notice, Setting, normalizePath, requestUrl } from "obsidian";
import type { LibraryItem } from "@zsviczian/excalidraw/types/excalidraw/types";
import type { ExcalidrawElement } from "@zsviczian/excalidraw/types/element/src/types";
import { restoreLibraryItems } from "src/constants/constants";
import { URLs } from "src/constants/safeUrls";
import type ExcalidrawPlugin from "src/core/main";
import { t } from "src/lang/helpers";
import type { FrameworkRemote } from "src/types/visualResourceTypes";

const DAY = 24 * 60 * 60 * 1000;

/** Read standard v2 libraries with unique stable item IDs and editable geometry. */
export function parseFrameworkLibrary(raw: string): LibraryItem[] {
  if (raw.length > 8 * 1024 * 1024) throw Error("Framework library is too large");
  const data = JSON.parse(raw) as { type?: string; version?: number; libraryItems?: LibraryItem[] };
  const ids = new Set<string>();
  if (data?.type !== "excalidrawlib" || data.version !== 2 || !Array.isArray(data.libraryItems) ||
      !data.libraryItems.length || data.libraryItems.length > 300 || data.libraryItems.some(item => {
        if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id) ||
            typeof item.name !== "string" || !item.name.trim() || !Array.isArray(item.elements) ||
            !item.elements.length || item.elements.length > 3000 || item.elements.some((element: ExcalidrawElement) =>
              !element || typeof element.id !== "string" || typeof element.type !== "string" ||
              ![element.x, element.y, element.width, element.height].every(Number.isFinite) ||
              element.type === "iframe" || element.type === "embeddable" || element.type === "image")) return true;
        ids.add(item.id);
        return false;
      })) throw Error("Invalid framework library");
  return [...restoreLibraryItems(data.libraryItems, "published")];
}

function parseCatalog(raw: string): FrameworkRemote[] {
  if (raw.length > 64 * 1024) throw Error("Framework catalog is too large");
  const data = JSON.parse(raw) as FrameworkRemote[];
  const names = new Set<string>();
  if (!Array.isArray(data) || data.length > 100 || data.some(entry => {
    if (!entry || typeof entry.fname !== "string" || !/^[a-z0-9][a-z0-9_-]{0,100}\.excalidrawlib$/i.test(entry.fname) ||
        !Number.isSafeInteger(entry.mtime) || entry.mtime <= 0 || names.has(entry.fname.toLowerCase())) return true;
    names.add(entry.fname.toLowerCase());
    return false;
  })) throw Error("Invalid framework catalog");
  return data;
}

/** Local framework provider and explicit, validated catalog installation. */
export class FrameworkCatalog {
  private checking: Promise<FrameworkRemote[]> | null = null;
  private installing: Promise<void> | null = null;
  private readonly cache = new Map<string, { mtime: number; items: LibraryItem[] }>();

  constructor(private readonly plugin: ExcalidrawPlugin) {}

  /** Use the configured folder, defaulting to Frameworks within the Excalidraw root. */
  public get folder(): string {
    return normalizePath(this.plugin.settings.frameworkFolder.trim() || this.plugin.settings.folder + "/Frameworks");
  }

  /** Discover local libraries without contacting the catalog service. */
  public async list() {
    const vault = this.plugin.app.vault;
    const paths = (vault.getFolderByPath(this.folder)?.children ?? [])
      .filter(child => child.name.toLowerCase().endsWith(".excalidrawlib") && vault.getFileByPath(child.path))
      .map(child => child.path);
    for (const path of this.cache.keys()) if (!paths.includes(path)) this.cache.delete(path);
    const result: Array<{ path: string; item: LibraryItem }> = [];
    for (const path of paths) {
      for (const item of await this.items(path)) result.push({ path, item });
    }
    return result;
  }

  /** Resolve one local library item, re-reading only when its file changed. */
  public async items(path: string): Promise<LibraryItem[]> {
    const vault = this.plugin.app.vault;
    const file = vault.getFileByPath(path);
    if (!file || file.parent?.path !== this.folder || file.extension.toLowerCase() !== "excalidrawlib") return [];
    const cached = this.cache.get(path);
    if (cached?.mtime === file.stat.mtime) return cached.items;
    const mtime = file.stat.mtime;
    try {
      const items = parseFrameworkLibrary(await vault.cachedRead(file));
      if (file.path === path && file.stat.mtime === mtime) this.cache.set(path, { mtime, items });
      return items;
    } catch { return []; }
  }

  /** Check on picker open under the shared version/script update policy. */
  public async updates(): Promise<FrameworkRemote[]> {
    if (!this.plugin.settings.showNewVersionNotification) return [];
    const catalog = await this.remote(false);
    return catalog.filter(entry => {
      const path = this.folder + "/" + entry.fname;
      const installed = this.plugin.settings.frameworkInstalls[path];
      return !!installed && installed.mtime < entry.mtime && !!this.plugin.app.vault.getFileByPath(path);
    });
  }

  private remote(explicit: boolean): Promise<FrameworkRemote[]> {
    if (this.checking !== null) return this.checking;
    const settings = this.plugin.settings;
    const now = Date.now();
    if ((!explicit || settings.frameworkCatalog.length) && now - settings.frameworkCatalogCheckedAt < DAY) {
      return Promise.resolve(settings.frameworkCatalog);
    }
    settings.frameworkCatalogCheckedAt = now;
    this.checking = (async () => {
      try {
        const response = await requestUrl({ url: URLs.VISUAL_FRAMEWORKS_CATALOG });
        settings.frameworkCatalog = parseCatalog(response.text);
        return settings.frameworkCatalog;
      } catch (error) {
        if (explicit) throw error;
        return settings.frameworkCatalog;
      } finally {
        await this.plugin.saveSettings();
      }
    })().finally(() => { this.checking = null; });
    return this.checking;
  }

  /** Install or update only after the user invokes this action. */
  public async install(): Promise<void> {
    this.installing ??= this.download().finally(() => { this.installing = null; });
    return this.installing;
  }

  private async download(): Promise<void> {
    const catalog = await this.remote(true);
    if (!catalog.length) throw Error("Framework catalog is empty");
    const vault = this.plugin.app.vault;
    const folder = this.folder;
    for (const entry of catalog) {
      const path = folder + "/" + entry.fname;
      const file = vault.getFileByPath(path);
      const previous = this.plugin.settings.frameworkInstalls[path];
      if (file && previous?.mtime === entry.mtime) continue;
      const content = (await requestUrl({ url: URLs.VISUAL_FRAMEWORKS_DIRECTORY + "/" + encodeURIComponent(entry.fname) })).text;
      parseFrameworkLibrary(content);
      const before = file ? await vault.read(file) : null;
      if (before !== null && previous?.digest !== await this.digest(before) && !await this.confirmReplace(entry.fname)) continue;
      if (this.folder !== folder || vault.getFileByPath(path) !== file) throw Error("Framework folder changed during installation");
      if (file) await vault.process(file, current => {
        if (current !== before) throw Error("Framework library changed during installation");
        return content;
      });
      else {
        if (!vault.getFolderByPath(folder)) await vault.createFolder(folder);
        await vault.create(path, content);
      }
      this.plugin.settings.frameworkInstalls[path] = { mtime: entry.mtime, digest: await this.digest(content) };
      this.cache.delete(path);
      await this.plugin.saveSettings();
    }
  }

  private async digest(content: string): Promise<string> {
    const win = this.plugin.app.workspace.containerEl.ownerDocument.defaultView;
    const bytes = new Uint8Array(await win.crypto.subtle.digest("SHA-256", new TextEncoder().encode(content)));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  }

  private confirmReplace(name: string): Promise<boolean> {
    return new Promise(resolve => {
      const modal = new Modal(this.plugin.app);
      modal.setTitle(t("VR_REPLACE_FRAMEWORK"));
      modal.contentEl.createEl("p", { text: name });
      modal.onClose = () => resolve(false);
      new Setting(modal.contentEl).addButton(button => button.setWarning().setButtonText(t("VR_REPLACE_FRAMEWORK")).onClick(() => {
        resolve(true);
        modal.close();
      }));
      modal.open();
    });
  }

  /** Report an actionable catalog failure without blocking blank drawing creation. */
  public notifyFailure(): void { new Notice(t("VR_DOWNLOAD_FAILED")); }
}
