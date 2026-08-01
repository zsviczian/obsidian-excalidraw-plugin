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
  private migrationPrompt: Promise<void> | null = null;
  private saveQueue: Promise<void> = Promise.resolve();
  private reloadTimer: number | null = null;
  private readonly ownWritePaths = new Set<string>();
  private isUpdatingOpenViews = false;

  constructor(private readonly plugin: ExcalidrawPlugin) {
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
        window.clearTimeout(this.reloadTimer);
      }
    });
  }

  public hasLegacyItems(): boolean {
    return getLibraryItems(this.plugin.getLegacyStencilLibrary()).length > 0;
  }

  public invalidate(): void {
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
      await this.loadFromVault();
    }
    return this.currentItems;
  }

  public async setLibrary(items: LibraryItems): Promise<void> {
    if (this.isUpdatingOpenViews) {
      return;
    }
    if (this.plugin.settings.libraryStorageMode === "data-json") {
      await this.plugin.setLegacyStencilLibrary(this.createFileData(items));
      return;
    }
    this.saveQueue = this.saveQueue.then(() => this.persistChanges(items));
    await this.saveQueue;
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
    await this.loadFromVault();
    this.isUpdatingOpenViews = true;
    try {
      for (const view of getExcalidrawViews(this.plugin.app, true)) {
        await view.excalidrawAPI.updateLibrary({
          libraryItems: this.currentItems,
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
      window.clearTimeout(this.reloadTimer);
    }
    this.reloadTimer = window.setTimeout(() => {
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

  private async loadFromVault(): Promise<void> {
    this.itemSource.clear();
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
        if (this.itemSource.has(item.id)) {
          console.warn(
            `Duplicate stencil library item id '${item.id}' in ${file.path}; keeping the first occurrence.`,
          );
          continue;
        }
        this.itemSource.set(item.id, file.path);
        combined.push(
          isLocalFile ? item : { ...item, status: "published" as const },
        );
      }
    }
    this.currentItems = combined;
    this.loaded = true;
  }

  private async persistChanges(nextItems: LibraryItems): Promise<void> {
    if (!this.loaded) {
      await this.loadFromVault();
    }
    const previousById = new Map(
      this.currentItems.map((item) => [item.id, item]),
    );
    const nextById = new Map(nextItems.map((item) => [item.id, item]));
    const affectedPaths = new Set<string>();
    const additions: LibraryItem[] = [];

    for (const item of this.currentItems) {
      const next = nextById.get(item.id);
      if (!next || JSON.stringify(next) !== JSON.stringify(item)) {
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
      if (JSON.stringify(existingData) !== JSON.stringify(nextData)) {
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

  /** Writes a non-empty library or removes its file when no items remain. */
  private async persistLibraryFile(
    path: string,
    data: StencilLibraryFileData,
  ): Promise<void> {
    const existing = this.plugin.app.vault.getFileByPath(path);
    if (data.libraryItems.length === 0 && !existing) {
      return;
    }
    this.ownWritePaths.add(path);
    try {
      if (data.libraryItems.length === 0) {
        await this.plugin.app.fileManager.trashFile(existing);
        return;
      }
      await this.ensureFolder();
      const content = JSON.stringify(data);
      if (existing) {
        await this.plugin.app.vault.modify(existing, content);
        return;
      }
      if (this.plugin.app.vault.getFolderByPath(path)) {
        throw new Error(`Library file path is a folder: ${path}`);
      }
      await this.plugin.app.vault.create(path, content);
    } finally {
      window.setTimeout(
        () => this.ownWritePaths.delete(path),
        OWN_WRITE_EVENT_WINDOW_MS,
      );
    }
  }
}
