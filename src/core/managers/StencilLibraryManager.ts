import { Notice, normalizePath, TFolder } from "obsidian";
import type {
  LibraryItem,
  LibraryItems,
} from "@zsviczian/excalidraw/types/excalidraw/types";
import type ExcalidrawPlugin from "src/core/main";
import { restoreLibraryItems } from "src/constants/constants";
import { URLs } from "src/constants/safeUrls";
import { t } from "src/lang/helpers";
import { StencilLibraryMigrationPrompt } from "src/shared/Dialogs/StencilLibraryMigrationPrompt";
import type {
  StencilLibraryData,
  StencilLibraryFileData,
} from "src/types/stencilLibraryTypes";
import { getExcalidrawViews } from "src/utils/obsidianUtils";

const LIBRARY_EXTENSION = "excalidrawlib";
const MIGRATION_SNOOZE_MS = 24 * 60 * 60 * 1000;
const LIBRARY_RELOAD_DEBOUNCE_MS = 300;
const OWN_WRITE_EVENT_WINDOW_MS = 2000;
declare const PLUGIN_VERSION: string;

const getLibraryItems = (data: StencilLibraryData | null): LibraryItems =>
  data?.libraryItems ?? data?.library ?? [];

const normalizeLibraryFileName = (fileName: string): string => {
  const trimmed = fileName.trim().replace(/[\\/]/g, "-");
  const withoutExtension = trimmed.replace(/\.excalidrawlib$/i, "");
  return withoutExtension || "local-library";
};

/**
 * Owns stencil-library persistence and keeps each item's source file stable.
 * Vault writes are reconciled with the latest file contents to avoid clobbering
 * files updated by sync after the library was loaded.
 */
export class StencilLibraryManager {
  private itemSource = new Map<LibraryItem["id"], string>();
  private currentItems: LibraryItems = [];
  private loaded = false;
  private loadRevision = 0;
  private loadPromise: Promise<void> | null = null;
  private migrationPrompt: Promise<void> | null = null;
  private saveQueue: Promise<void> = Promise.resolve();
  private reloadTimer: number | null = null;
  private readonly ownWritePaths = new Map<string, number>();
  private isUpdatingOpenViews = false;
  private readonly ownerWindow: Window;

  constructor(private readonly plugin: ExcalidrawPlugin) {
    this.ownerWindow = plugin.app.workspace.containerEl.ownerDocument.defaultView;
    const handleLibraryFileChange = (file: { path: string }) => {
      if (
        file.path.startsWith(`${this.getFolderPath()}/`) &&
        file.path.toLowerCase().endsWith(`.${LIBRARY_EXTENSION}`)
      ) {
        if (this.ownWritePaths.has(file.path)) {
          return;
        }
        this.invalidate();
        if (this.plugin.settings.libraryStorageMode === "vault") {
          this.scheduleOpenViewReload();
        }
      }
    };
    plugin.registerEvent(
      plugin.app.vault.on("create", handleLibraryFileChange),
    );
    plugin.registerEvent(
      plugin.app.vault.on("modify", handleLibraryFileChange),
    );
    plugin.registerEvent(
      plugin.app.vault.on("delete", handleLibraryFileChange),
    );
    plugin.registerEvent(
      plugin.app.vault.on("rename", (file, oldPath) => {
        handleLibraryFileChange(file);
        handleLibraryFileChange({ path: oldPath });
      }),
    );
    plugin.register(() => {
      if (this.reloadTimer !== null) {
        this.ownerWindow.clearTimeout(this.reloadTimer);
      }
      for (const timeout of this.ownWritePaths.values()) this.ownerWindow.clearTimeout(timeout);
      this.ownWritePaths.clear();
    });
  }

  public hasLegacyItems(): boolean {
    return getLibraryItems(this.plugin.getLegacyStencilLibrary()).length > 0;
  }

  public invalidate(): void {
    this.loadRevision++;
    this.loaded = false;
    this.itemSource.clear();
    this.currentItems = [];
  }

  public async getLibrary(): Promise<LibraryItems> {
    await this.ensureMigrationDecision();
    if (this.plugin.settings.libraryStorageMode === "data-json") {
      return restoreLibraryItems(
        getLibraryItems(this.plugin.getLegacyStencilLibrary()),
        "unpublished",
      );
    }
    if (
      this.hasLegacyItems() &&
      (this.plugin.settings.libraryMigrationStatus === "completed" ||
        this.plugin.settings.libraryMigrationStatus === "not-required")
    ) {
      // A sync conflict can restore stale data.json items after migration.
      // Merge them idempotently before clearing the legacy copy again.
      await this.migrateLegacyLibrary();
    }
    if (!this.loaded) {
      await this.ensureLoaded();
    }
    return this.currentItems;
  }

  public async setLibrary(items: LibraryItems): Promise<void> {
    if (this.isUpdatingOpenViews) {
      return;
    }
    await this.queueSave(() => this.plugin.settings.libraryStorageMode === "data-json"
      ? this.plugin.setLegacyStencilLibrary(this.createFileData(items))
      : this.persistChanges(items));
  }

  /** Read the effective items, their owners, and the valid destination libraries. */
  public async getResourceLibraries(): Promise<{
    items: Array<{ item: LibraryItem; path: string | undefined }>;
    paths: string[];
    defaultPath?: string;
  }> {
    await this.saveQueue;
    if (this.plugin.settings.libraryStorageMode === "data-json") {
      const items = restoreLibraryItems(getLibraryItems(this.plugin.getLegacyStencilLibrary()), "unpublished");
      const owned = items.map<{ item: LibraryItem; path: string | undefined }>(item => ({ item, path: undefined }));
      return { items: owned, paths: [] };
    }
    await this.ensureLoaded();
    const defaultPath = this.getLocalLibraryPath();
    const paths = [defaultPath, ...this.libraryFiles().filter(file => file.path !== defaultPath).map(file => file.path)];
    return { items: this.currentItems.map(item => ({ item, path: this.itemSource.get(item.id) })), paths, defaultPath };
  }

  /** Rename one stencil in its current owner without rewriting its elements. */
  public async renameResourceStencil(path: string | undefined, id: string, name: string): Promise<void> {
    const title = name.trim();
    if (!title) throw Error("Stencil name is empty");
    const rename = (items: LibraryItems): LibraryItems => {
      const matching = items.filter(item => item.id === id);
      if (matching.length !== 1) throw Error("Stencil no longer has a unique match in its library");
      if (matching[0].name === title) return items;
      return items.map(item => item.id === id ? { ...item, name: title } : item);
    };
    if (path === undefined) {
      await this.queueSave(async () => {
        if (this.plugin.settings.libraryStorageMode !== "data-json") throw Error("Stencil storage changed");
        const data = this.plugin.getLegacyStencilLibrary();
        const items = getLibraryItems(data);
        const renamed = rename(items);
        if (renamed === items) return;
        await this.plugin.setLegacyStencilLibrary(this.withLibraryItems(data, renamed));
        await this.updateLibrariesInOpenViews(restoreLibraryItems(renamed, "unpublished"));
      });
      return;
    }
    await this.editResourceLibraries(async () => {
      const vault = this.plugin.app.vault;
      const file = vault.getFileByPath(path);
      if (!file) throw Error("Library is missing");
      await vault.process(file, raw => {
        const data = this.parseLibrary(raw);
        const items = getLibraryItems(data);
        const renamed = rename(items);
        return renamed === items ? raw : JSON.stringify(this.withLibraryItems(data, renamed), null, 2);
      });
    }, path);
  }

  /** Create an empty standard library in the configured vault folder. */
  public async createResourceLibrary(name: string): Promise<string> {
    const filename = name.trim().replace(/\.excalidrawlib$/i, "");
    if (!filename || filename.startsWith(".") || /[\\/:*?"<>|]/.test(filename) || filename.endsWith(".")) {
      throw Error("Invalid library filename");
    }
    const path = this.getFolderPath() + "/" + filename + "." + LIBRARY_EXTENSION;
    await this.editResourceLibraries(async () => {
      if (this.plugin.app.vault.getAbstractFileByPath(path)) throw Error("Library already exists");
      await this.ensureFolder();
      await this.plugin.app.vault.create(path, JSON.stringify(this.createFileData([]), null, 2));
    }, path);
    return path;
  }

  /** Copy first, verify the destination, then remove only unchanged source items. */
  public async moveResourceStencils(source: string, destination: string, ids: readonly string[]): Promise<void> {
    if (source === destination || !ids.length) return;
    await this.editResourceLibraries(async () => this.moveItems(source, destination, new Set(ids)), source, destination);
  }

  /** Trash a library only after a confirmed delete or a completed move of its contents. */
  public async deleteResourceLibrary(path: string, destination: string | null, confirmedIds: readonly string[]): Promise<void> {
    if (path === destination) throw Error("Source and destination must differ");
    await this.editResourceLibraries(async () => {
      const vault = this.plugin.app.vault;
      const file = vault.getFileByPath(path);
      if (!file) return;
      const confirmed = new Set(confirmedIds);
      const current = getLibraryItems(this.parseLibrary(await vault.read(file)));
      if (current.some(item => !confirmed.has(item.id))) throw Error("Library contents changed");
      if (destination) {
        await this.moveItems(path, destination, new Set(current.map(item => item.id)));
        if (getLibraryItems(this.parseLibrary(await vault.read(file))).length) throw Error("Library contents changed");
      }
      await this.plugin.app.fileManager.trashFile(file);
    }, ...(destination ? [path, destination] : [path]));
  }

  private async moveItems(source: string, destination: string, ids: ReadonlySet<string>): Promise<void> {
    const vault = this.plugin.app.vault;
    const sourceFile = vault.getFileByPath(source);
    let destinationFile = vault.getFileByPath(destination);
    if (!sourceFile || !destinationFile && destination !== this.getLocalLibraryPath()) throw Error("Library is missing");
    const sourceItems = getLibraryItems(this.parseLibrary(await vault.read(sourceFile)));
    const moving = sourceItems.filter(item => ids.has(item.id));
    if (!moving.length) return;
    if (new Set(moving.map(item => item.id)).size !== moving.length) throw Error("Duplicate stencil IDs in source library");
    const merge = (data: StencilLibraryData) => {
      const items = getLibraryItems(data);
      for (const item of moving) {
        const existing = items.find(other => other.id === item.id);
        if (existing && JSON.stringify(existing) !== JSON.stringify(item)) throw Error("Destination stencil ID collision");
      }
      return this.withLibraryItems(data, this.mergeById(items, moving));
    };
    if (!destinationFile) {
      await this.ensureFolder();
      destinationFile = await vault.create(destination, JSON.stringify(merge(this.createFileData([])), null, 2));
    } else {
      await vault.process(destinationFile, raw => JSON.stringify(merge(this.parseLibrary(raw)), null, 2));
    }
    const destinationRevision = destinationFile.stat.mtime;
    const recorded = getLibraryItems(this.parseLibrary(await vault.read(destinationFile)));
    if (!moving.every(item => recorded.some(other => JSON.stringify(item) === JSON.stringify(other)))) {
      throw Error("Destination stencil write could not be verified");
    }
    const expected = new Map(moving.map(item => [item.id, JSON.stringify(item)]));
    await vault.process(sourceFile, raw => {
      if (vault.getFileByPath(destination) !== destinationFile || destinationFile.stat.mtime !== destinationRevision) {
        throw Error("Destination library changed during move");
      }
      const data = this.parseLibrary(raw);
      const items = getLibraryItems(data);
      if (items.some(item => expected.has(item.id) && expected.get(item.id) !== JSON.stringify(item))) {
        throw Error("Stencil changed during move; both copies were kept");
      }
      return JSON.stringify(this.withLibraryItems(data, items.filter(item => !expected.has(item.id))), null, 2);
    });
  }

  private parseLibrary(raw: string): StencilLibraryData {
    const data = JSON.parse(raw) as StencilLibraryData;
    if (data?.type !== "excalidrawlib" || data.version !== 2 || !Array.isArray(data.libraryItems)) throw Error("Invalid stencil library");
    return data;
  }

  private withLibraryItems(data: StencilLibraryData, items: LibraryItems): StencilLibraryFileData {
    return { ...data, type: "excalidrawlib", version: 2, libraryItems: items };
  }

  private libraryFiles() {
    const folder = this.getFolderPath();
    return this.plugin.app.vault.getFolderByPath(folder)?.children.filter(file =>
      !(file instanceof TFolder) && file.name.toLowerCase().endsWith("." + LIBRARY_EXTENSION)) ?? [];
  }

  private queueSave(edit: () => Promise<void>): Promise<void> {
    const pending = this.saveQueue.then(edit);
    this.saveQueue = pending.catch(() => {});
    return pending;
  }

  private async editResourceLibraries(edit: () => Promise<void>, ...paths: string[]): Promise<void> {
    try { await this.queueSave(async () => {
      if (this.plugin.settings.libraryStorageMode !== "vault" || paths.some(path =>
        path.slice(0, path.lastIndexOf("/")) !== this.getFolderPath() || !path.toLowerCase().endsWith("." + LIBRARY_EXTENSION))) {
        throw Error("Vault stencil libraries are required");
      }
      try { await edit(); }
      finally { this.invalidate(); }
    }); }
    finally { await this.reloadLibrariesInOpenViews(); }
  }

  public async showMigrationPrompt(): Promise<void> {
    if (this.migrationPrompt !== null) {
      return this.migrationPrompt;
    }
    this.migrationPrompt = this.runMigrationPrompt().finally(() => {
      this.migrationPrompt = null;
    });
    return this.migrationPrompt;
  }

  public async switchToLegacyStorage(): Promise<void> {
    const items = await this.getVaultLibrary();
    await this.plugin.setLegacyStencilLibrary(
      this.createFileData(items),
      false,
    );
    this.plugin.settings.libraryStorageMode = "data-json";
    this.plugin.settings.libraryMigrationStatus = "opted-out";
    this.plugin.settings.libraryMigrationSnoozeUntil = 0;
    await this.plugin.saveSettings();
    this.invalidate();
  }

  /** Reloads the merged vault library in every initialized Excalidraw view. */
  public async reloadLibrariesInOpenViews(): Promise<void> {
    if (this.plugin.settings.libraryStorageMode !== "vault") {
      return;
    }
    await this.saveQueue;
    this.invalidate();
    await this.ensureLoaded();
    await this.updateLibrariesInOpenViews(this.currentItems);
  }

  private async updateLibrariesInOpenViews(items: LibraryItems): Promise<void> {
    this.isUpdatingOpenViews = true;
    try {
      for (const view of getExcalidrawViews(this.plugin.app, true)) {
        await view.excalidrawAPI.updateLibrary({
          libraryItems: items,
          merge: false,
        });
      }
    } finally {
      this.isUpdatingOpenViews = false;
    }
  }

  private async ensureMigrationDecision(): Promise<void> {
    const status = this.plugin.settings.libraryMigrationStatus;
    const isSnoozed =
      status === "later" &&
      Date.now() < this.plugin.settings.libraryMigrationSnoozeUntil;
    if (status !== "pending" && (status !== "later" || isSnoozed)) {
      return;
    }
    await this.showMigrationPrompt();
  }

  private async runMigrationPrompt(): Promise<void> {
    const result = await new StencilLibraryMigrationPrompt(this.plugin).start();
    this.plugin.settings.libraryFolderPath = result.folderPath;
    this.plugin.settings.libraryFileName = normalizeLibraryFileName(
      result.fileName,
    );

    if (result.choice === "migrate") {
      try {
        await this.migrateLegacyLibrary();
        new Notice(t("LIBRARY_MIGRATION_SUCCESS"));
      } catch (error) {
        console.error("Stencil library migration failed", error);
        this.plugin.settings.libraryStorageMode = "data-json";
        this.plugin.settings.libraryMigrationStatus = "later";
        this.plugin.settings.libraryMigrationSnoozeUntil =
          Date.now() + MIGRATION_SNOOZE_MS;
        await this.plugin.saveSettings();
        new Notice(t("LIBRARY_MIGRATION_FAILED"), 8000);
      }
      return;
    }

    this.plugin.settings.libraryStorageMode = "data-json";
    this.plugin.settings.libraryMigrationStatus =
      result.choice === "later" ? "later" : "opted-out";
    this.plugin.settings.libraryMigrationSnoozeUntil =
      result.choice === "later" ? Date.now() + MIGRATION_SNOOZE_MS : 0;
    await this.plugin.saveSettings();
    this.invalidate();
  }

  private async migrateLegacyLibrary(): Promise<void> {
    const previousLibrary = this.plugin.settings.library;
    const previousLibrary2 = this.plugin.settings.library2;
    const previousStorageMode = this.plugin.settings.libraryStorageMode;
    const previousMigrationStatus = this.plugin.settings.libraryMigrationStatus;
    const previousMigrationSnoozeUntil =
      this.plugin.settings.libraryMigrationSnoozeUntil;
    const legacyItems = restoreLibraryItems(
      getLibraryItems(this.plugin.getLegacyStencilLibrary()),
      "unpublished",
    );
    const path = this.getLocalLibraryPath();
    const existing = await this.readLibraryFile(path);
    const existingItems = restoreLibraryItems(
      getLibraryItems(existing),
      "unpublished",
    );
    const merged = this.mergeById(existingItems, legacyItems);
    await this.persistLibraryFile(path, this.createFileData(merged));

    const verified = await this.readLibraryFile(path);
    const verifiedIds = new Set(
      restoreLibraryItems(getLibraryItems(verified), "unpublished").map(
        (item) => item.id,
      ),
    );
    if (legacyItems.some((item) => !verifiedIds.has(item.id))) {
      throw new Error("Not all legacy library items were written");
    }

    this.plugin.settings.libraryStorageMode = "vault";
    this.plugin.settings.libraryMigrationStatus = "completed";
    this.plugin.settings.libraryMigrationSnoozeUntil = 0;
    await this.plugin.setLegacyStencilLibrary(this.createFileData([]), false);
    try {
      await this.plugin.saveSettings();
    } catch (error) {
      // The verified vault file remains as a safe recovery copy, while the
      // in-memory settings are restored so a retry cannot clear data.json.
      this.plugin.settings.library = previousLibrary;
      this.plugin.settings.library2 = previousLibrary2;
      this.plugin.settings.libraryStorageMode = previousStorageMode;
      this.plugin.settings.libraryMigrationStatus = previousMigrationStatus;
      this.plugin.settings.libraryMigrationSnoozeUntil =
        previousMigrationSnoozeUntil;
      throw error;
    }
    await this.reloadLibrariesInOpenViews();
  }

  private scheduleOpenViewReload(): void {
    if (this.reloadTimer !== null) {
      this.ownerWindow.clearTimeout(this.reloadTimer);
    }
    this.reloadTimer = this.ownerWindow.setTimeout(() => {
      this.reloadTimer = null;
      void this.reloadLibrariesInOpenViews().catch((error) =>
        console.error("Could not reload stencil libraries", error),
      );
    }, LIBRARY_RELOAD_DEBOUNCE_MS);
  }

  private async getVaultLibrary(): Promise<LibraryItems> {
    const previousMode = this.plugin.settings.libraryStorageMode;
    this.plugin.settings.libraryStorageMode = "vault";
    this.invalidate();
    try {
      return await this.getLibrary();
    } finally {
      this.plugin.settings.libraryStorageMode = previousMode;
    }
  }

  /** Coalesces concurrent view initialization into one vault-library load. */
  private async ensureLoaded(): Promise<void> {
    while (!this.loaded) {
      if (this.loadPromise === null) {
        const revision = this.loadRevision;
        this.loadPromise = this.loadFromVault().then(
          ({ itemSource, items }) => {
            if (revision !== this.loadRevision) {
              return;
            }
            this.itemSource = itemSource;
            this.currentItems = items;
            this.loaded = true;
          },
        );
      }
      const activeLoad: Promise<void> = this.loadPromise;
      try {
        await activeLoad;
      } finally {
        if (this.loadPromise === activeLoad) {
          this.loadPromise = null;
        }
      }
    }
  }

  /** Reads a coherent library snapshot without mutating the active cache. */
  private async loadFromVault(): Promise<{
    itemSource: Map<LibraryItem["id"], string>;
    items: LibraryItems;
  }> {
    const itemSource = new Map<LibraryItem["id"], string>();
    const folderPath = this.getFolderPath();
    const localPath = this.getLocalLibraryPath();
    const files = this.plugin.app.vault
      .getFiles()
      .filter(
        (file) =>
          file.parent?.path === folderPath &&
          file.extension.toLowerCase() === LIBRARY_EXTENSION,
      )
      .sort((a, b) => {
        if (a.path === localPath) return -1;
        if (b.path === localPath) return 1;
        return a.path.localeCompare(b.path);
      });

    const combined: LibraryItem[] = [];
    for (const file of files) {
      const data = await this.readLibraryFile(file.path);
      if (!data) {
        continue;
      }
      const isLocalFile = file.path === localPath;
      const items = restoreLibraryItems(
        getLibraryItems(data),
        isLocalFile ? "unpublished" : "published",
      );
      for (const item of items) {
        if (itemSource.has(item.id)) {
          console.warn(
            `Duplicate stencil library item id '${item.id}' in ${file.path}; keeping the first occurrence.`,
          );
          continue;
        }
        itemSource.set(item.id, file.path);
        combined.push(
          isLocalFile ? item : { ...item, status: "published" as const },
        );
      }
    }
    return { itemSource, items: combined };
  }

  private async persistChanges(nextItems: LibraryItems): Promise<void> {
    if (!this.loaded) {
      await this.ensureLoaded();
    }
    const previousById = new Map(
      this.currentItems.map((item) => [item.id, item]),
    );
    const nextById = new Map(nextItems.map((item) => [item.id, item]));
    const affectedPaths = new Set<string>();
    const additions: LibraryItem[] = [];

    for (const item of this.currentItems) {
      const next = nextById.get(item.id);
      if (!next || JSON.stringify(next, null, 2) !== JSON.stringify(item, null, 2)) {
        affectedPaths.add(
          this.itemSource.get(item.id) ?? this.getLocalLibraryPath(),
        );
      }
    }
    for (const item of nextItems) {
      if (!previousById.has(item.id)) {
        additions.push(item);
        affectedPaths.add(this.getLocalLibraryPath());
      }
    }

    for (const path of affectedPaths) {
      const existingData =
        (await this.readLibraryFile(path)) ?? this.createFileData([]);
      const existingItems = restoreLibraryItems(
        getLibraryItems(existingData),
        path === this.getLocalLibraryPath() ? "unpublished" : "published",
      );
      const updated: LibraryItem[] = [];
      for (const diskItem of existingItems) {
        if (this.itemSource.get(diskItem.id) !== path) {
          updated.push(diskItem);
          continue;
        }
        const next = nextById.get(diskItem.id);
        if (next) {
          updated.push(this.withFileStatus(next, path));
        }
      }
      if (path === this.getLocalLibraryPath()) {
        for (const item of additions) {
          if (!updated.some((candidate) => candidate.id === item.id)) {
            updated.unshift(this.withFileStatus(item, path));
            this.itemSource.set(item.id, path);
          }
        }
      }
      const nextData: StencilLibraryFileData = {
        ...existingData,
        type: "excalidrawlib",
        version: 2,
        libraryItems: updated,
      };
      if (JSON.stringify(existingData, null, 2) !== JSON.stringify(nextData, null, 2)) {
        await this.persistLibraryFile(path, nextData);
      }
    }

    const nextItemSource = new Map<LibraryItem["id"], string>();
    this.currentItems = nextItems.map((item) => {
      const path = this.itemSource.get(item.id) ?? this.getLocalLibraryPath();
      nextItemSource.set(item.id, path);
      return this.withFileStatus(item, path);
    });
    this.itemSource = nextItemSource;
  }

  private withFileStatus(item: LibraryItem, path: string): LibraryItem {
    return path === this.getLocalLibraryPath()
      ? item
      : { ...item, status: "published" };
  }

  private mergeById(
    preferred: LibraryItems,
    additional: LibraryItems,
  ): LibraryItems {
    const seen = new Set(preferred.map((item) => item.id));
    return [...preferred, ...additional.filter((item) => !seen.has(item.id))];
  }

  private createFileData(items: LibraryItems): StencilLibraryFileData {
    return {
      type: "excalidrawlib",
      version: 2,
      source: `${URLs.GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_RELEASES_TAG}/${PLUGIN_VERSION}`,
      libraryItems: items,
    };
  }

  private getFolderPath(): string {
    return normalizePath(
      this.plugin.settings.libraryFolderPath.trim() ||
        `${this.plugin.settings.folder}/Libraries`,
    );
  }

  private getLocalLibraryPath(): string {
    return normalizePath(
      `${this.getFolderPath()}/${normalizeLibraryFileName(
        this.plugin.settings.libraryFileName,
      )}.${LIBRARY_EXTENSION}`,
    );
  }

  private async ensureFolder(): Promise<TFolder> {
    const path = this.getFolderPath();
    const folder = this.plugin.app.vault.getFolderByPath(path);
    if (folder) {
      return folder;
    }
    if (this.plugin.app.vault.getFileByPath(path)) {
      throw new Error(`Library folder path is a file: ${path}`);
    }
    return this.plugin.app.vault.createFolder(path);
  }

  private async readLibraryFile(
    path: string,
  ): Promise<StencilLibraryData | null> {
    const file = this.plugin.app.vault.getFileByPath(path);
    if (!file) {
      return null;
    }
    try {
      return JSON.parse(
        await this.plugin.app.vault.read(file),
      ) as StencilLibraryData;
    } catch (error) {
      console.error(`Could not read stencil library ${path}`, error);
      new Notice(t("LIBRARY_FILE_READ_ERROR").replace("{PATH}", path), 8000);
      return null;
    }
  }

  /** Write a standard library file, retaining empty libraries as destinations. */
  private async persistLibraryFile(
    path: string,
    data: StencilLibraryFileData,
  ): Promise<void> {
    const existing = this.plugin.app.vault.getFileByPath(path);
    if (data.libraryItems.length === 0 && !existing) {
      return;
    }
    const prior = this.ownWritePaths.get(path);
    if (prior !== undefined) this.ownerWindow.clearTimeout(prior);
    this.ownWritePaths.set(path, 0);
    try {
      await this.ensureFolder();
      const content = JSON.stringify(data, null, 2);
      if (existing) {
        await this.plugin.app.vault.modify(existing, content);
        return;
      }
      if (this.plugin.app.vault.getFolderByPath(path)) {
        throw new Error(`Library file path is a folder: ${path}`);
      }
      await this.plugin.app.vault.create(path, content);
    } finally {
      this.ownWritePaths.set(path, this.ownerWindow.setTimeout(
        () => this.ownWritePaths.delete(path),
        OWN_WRITE_EVENT_WINDOW_MS,
      ));
    }
  }
}
