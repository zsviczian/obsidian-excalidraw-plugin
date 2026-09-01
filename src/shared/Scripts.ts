import {
  App,
  Instruction,
  normalizePath,
  TAbstractFile,
  TFile,
} from "obsidian";
import { PLUGIN_ID } from "../constants/constants";
import ExcalidrawView from "../view/ExcalidrawView";
import ExcalidrawPlugin from "../core/main";
import { GenericInputPrompt, GenericSuggester } from "./Dialogs/Prompt";
import { getIMGFilename } from "../utils/fileUtils";
import { splitFolderAndFilename } from "../utils/fileUtils";
import { getEA } from "src/core";
import { ExcalidrawAutomate } from "../shared/ExcalidrawAutomate";
import { WeakArray } from "./WeakArray";
import {
  getExcalidrawViews,
  stripYamlFrontmatter,
} from "../utils/obsidianUtils";
import { ButtonDefinition, InputPromptOptions } from "src/types/promptTypes";
import { errorlog } from "src/utils/coreUtils";
import {
  type ScriptFileExtension,
  getPreferredScriptFiles,
  isScriptFilePath,
  replaceScriptFileExtension,
  resolveConfiguredStartupScriptPath,
} from "src/utils/scriptFileUtils";

export type ScriptIconMap = {
  [key: string]: { name: string; group: string; svgString: string };
};

/** Identifies why the script engine invoked a script. */
export type ScriptExecutionSource =
  | "manual"
  | "plugin-startup"
  | "view-autostart"
  | "sidepanel-restore"
  | "sidepanel-reload"
  | "drawing-onload";

type ScriptExecutable = (
  ea: ExcalidrawAutomate,
  utils: Record<string, unknown>,
) => Promise<unknown>;

type CompiledScript = {
  path: string;
  mtime: number;
  size: number;
  executable: ScriptExecutable | null;
};

export interface ScriptFileRenamePlan {
  renames: Array<{
    file: TFile;
    sourcePath: string;
    destinationPath: string;
  }>;
  conflicts: string[];
  includesStartupScript: boolean;
}

export class ScriptEngine {
  private plugin: ExcalidrawPlugin;
  private app: App;
  private scriptPath: string;
  //https://stackoverflow.com/questions/60218638/how-to-force-re-render-if-map-value-changes
  public scriptIconMap: ScriptIconMap;
  eaInstances = new WeakArray<ExcalidrawAutomate>();
  /**
   * Selected-element action-provider unregister callbacks registered via
   * `ExcalidrawAutomate.registerElementActionProvider()`, keyed by script
   * name. Cleared in `unloadScript()` so a deleted script's buttons don't
   * linger in views that are still open.
   */
  private elementActionProviders = new Map<string, Set<() => void>>();
  private scriptFileEventsSuspended = false;
  private scriptRegistryGeneration = 0;
  private loadedScriptPaths = new Set<string>();
  /** Compiled code keyed by vault path. EA instances and script state are never cached. */
  private compiledScripts = new Map<string, Promise<CompiledScript>>();
  /** Successful or in-flight automatic attachments, scoped to a view and script path. */
  private autostartAttachments = new WeakMap<
    ExcalidrawView,
    Map<string, Promise<void>>
  >();
  /** EAs whose top-level script invocation currently has a view-autostart trigger. */
  private viewAutostartEAs = new WeakSet<ExcalidrawAutomate>();

  constructor(plugin: ExcalidrawPlugin) {
    this.plugin = plugin;
    this.app = plugin.app;
    this.scriptIconMap = {};
    void this.loadScripts();
    this.registerEventHandlers();
  }

  public removeViewEAs(view: ExcalidrawView) {
    const eas = new Set<ExcalidrawAutomate>();
    this.eaInstances.forEach((ea) => {
      if (ea.targetView === view) {
        eas.add(ea);
        if (ea.sidepanelTab) {
          ea.targetView = null;
          ea.sidepanelTab.onExcalidrawViewClosed();
        } else {
          ea.destroy();
        }
      }
    });
    this.eaInstances.removeObjects(eas);
  }

  public destroy() {
    this.eaInstances.forEach((ea) => ea.destroy());
    this.eaInstances.clear();
    this.eaInstances = null;
    this.elementActionProviders.clear();
    this.loadedScriptPaths.clear();
    this.compiledScripts.clear();
    this.autostartAttachments = new WeakMap();
    this.viewAutostartEAs = new WeakSet();
    this.scriptIconMap = null;
    this.plugin = null;
    this.scriptPath = null;
  }

  private isInScriptFolder(path: string): boolean {
    return Boolean(
      this.scriptPath && path.startsWith(`${normalizePath(this.scriptPath)}/`),
    );
  }

  private isJavaScriptPath(path: string): boolean {
    return path.toLowerCase().endsWith(".js");
  }

  private isScriptPath(path: string): boolean {
    return (
      path.toLowerCase().endsWith(".md") ||
      (this.plugin.settings.allowJavaScriptFiles && this.isJavaScriptPath(path))
    );
  }

  /**
   * Resolves the configured startup-script path without changing the stored
   * setting. Extensionless paths retain the historical `.md` default; an
   * explicit `.js` path is accepted only when JavaScript-file loading is
   * enabled.
   */
  public resolveStartupScriptPath(configuredPath: string): string | null {
    const path = resolveConfiguredStartupScriptPath(configuredPath);
    if (!path) {
      return null;
    }
    if (this.isJavaScriptPath(path)) {
      return this.plugin.settings.allowJavaScriptFiles ? path : null;
    }
    return path;
  }

  /** Returns whether an EA is currently running because of view autostart. */
  public isViewAutostartExecution(ea: ExcalidrawAutomate): boolean {
    return this.viewAutostartEAs.has(ea);
  }

  private invalidateCompiledScript(path: string): void {
    this.compiledScripts.delete(path);
  }

  private clearCompiledScripts(): void {
    this.compiledScripts.clear();
  }

  private clearAutostartAttachment(path: string): void {
    getExcalidrawViews(this.app, true).forEach((view) => {
      this.autostartAttachments.get(view)?.delete(path);
    });
  }

  private compileScript(source: string): ScriptExecutable | null {
    const script = stripYamlFrontmatter(source);
    if (!script) {
      return null;
    }
    const AsyncFunction = (async () => {}).constructor as unknown as {
      new (...args: string[]): ScriptExecutable;
    };
    return new AsyncFunction("ea", "utils", script);
  }

  /**
   * Returns compiled code for the current file version. In-flight requests for
   * the same path share one promise, while event and stat checks prevent stale
   * code from surviving edits or renames.
   */
  private async getCompiledScript(
    file: TFile,
  ): Promise<ScriptExecutable | null> {
    while (true) {
      const path = file.path;
      const mtime = file.stat.mtime;
      const size = file.stat.size;
      const cachedPromise = this.compiledScripts.get(path);

      if (cachedPromise !== undefined) {
        try {
          const cached = await cachedPromise;
          if (this.compiledScripts.get(path) !== cachedPromise) {
            continue;
          }
          if (
            file.path === cached.path &&
            file.stat.mtime === cached.mtime &&
            file.stat.size === cached.size
          ) {
            return cached.executable;
          }
          this.compiledScripts.delete(path);
        } catch (error: unknown) {
          if (this.compiledScripts.get(path) === cachedPromise) {
            this.compiledScripts.delete(path);
          }
          throw error;
        }
        continue;
      }

      const compilePromise = (async (): Promise<CompiledScript> => {
        const source = await this.app.vault.read(file);
        return {
          path,
          mtime,
          size,
          executable: this.compileScript(source),
        };
      })();
      this.compiledScripts.set(path, compilePromise);

      try {
        const compiled = await compilePromise;
        if (this.compiledScripts.get(path) !== compilePromise) {
          continue;
        }
        if (
          file.path !== path ||
          file.stat.mtime !== mtime ||
          file.stat.size !== size
        ) {
          this.compiledScripts.delete(path);
          continue;
        }
        return compiled.executable;
      } catch (error: unknown) {
        if (this.compiledScripts.get(path) === compilePromise) {
          this.compiledScripts.delete(path);
        }
        throw error;
      }
    }
  }

  private modifyEventHandler(file: TAbstractFile): void {
    if (file instanceof TFile && this.compiledScripts.has(file.path)) {
      this.invalidateCompiledScript(file.path);
    }
  }

  private async deleteEventHandler(file: TFile) {
    if (this.scriptFileEventsSuspended) {
      return;
    }
    if (!(file instanceof TFile)) {
      return;
    }
    this.invalidateCompiledScript(file.path);
    this.clearAutostartAttachment(file.path);
    if (!this.isInScriptFolder(file.path)) {
      return;
    }
    if (isScriptFilePath(file.path)) {
      const scriptName = this.getScriptName(file);
      const wasLoaded = Boolean(this.scriptIconMap[file.path]);
      if (wasLoaded || !this.isJavaScriptPath(file.path)) {
        await this.reloadScripts();
      }
      if (!this.getScriptFileByName(scriptName)) {
        await this.purgeAutostartPermission(scriptName);
      }
      return;
    }
    if (file.extension.toLowerCase() === "svg") {
      await this.reloadScripts();
    }
  }

  private async createEventHandler(file: TFile) {
    if (this.scriptFileEventsSuspended) {
      return;
    }
    if (!(file instanceof TFile)) {
      return;
    }
    this.invalidateCompiledScript(file.path);
    if (!this.isInScriptFolder(file.path)) {
      return;
    }
    if (
      this.isScriptPath(file.path) ||
      file.extension.toLowerCase() === "svg"
    ) {
      await this.reloadScripts();
    }
  }

  private async renameEventHandler(file: TAbstractFile, oldPath: string) {
    if (this.scriptFileEventsSuspended) {
      return;
    }
    if (!(file instanceof TFile)) {
      return;
    }
    this.invalidateCompiledScript(oldPath);
    this.invalidateCompiledScript(file.path);
    this.clearAutostartAttachment(oldPath);
    const oldPathWasLoaded = Boolean(this.scriptIconMap[oldPath]);
    const oldFileWasScript =
      this.isInScriptFolder(oldPath) && isScriptFilePath(oldPath);
    const newFileIsScript =
      this.isInScriptFolder(file.path) && this.isScriptPath(file.path);
    const iconChanged =
      (this.isInScriptFolder(oldPath) &&
        oldPath.toLowerCase().endsWith(".svg")) ||
      (this.isInScriptFolder(file.path) &&
        file.extension.toLowerCase() === "svg");
    const oldScriptName = oldFileWasScript ? this.getScriptName(oldPath) : null;

    if (oldPathWasLoaded || newFileIsScript || iconChanged) {
      await this.reloadScripts();
    }
    if (oldScriptName && !this.getScriptFileByName(oldScriptName)) {
      await this.purgeAutostartPermission(oldScriptName);
    }
  }

  registerEventHandlers() {
    this.plugin.registerEvent(
      this.app.vault.on("delete", (file: TFile) =>
        this.deleteEventHandler(file),
      ),
    );
    this.plugin.registerEvent(
      this.app.vault.on("create", (file: TFile) =>
        this.createEventHandler(file),
      ),
    );
    this.plugin.registerEvent(
      this.app.vault.on("rename", (file: TAbstractFile, oldPath: string) =>
        this.renameEventHandler(file, oldPath),
      ),
    );
    this.plugin.registerEvent(
      this.app.vault.on("modify", (file: TAbstractFile) =>
        this.modifyEventHandler(file),
      ),
    );
  }

  updateScriptPath() {
    if (this.scriptPath === this.plugin.settings.scriptFolderPath) {
      return;
    }
    this.clearCompiledScripts();
    this.autostartAttachments = new WeakMap();
    void this.reloadScripts();
  }

  public getListofScripts(): TFile[] {
    this.scriptPath = this.plugin.settings.scriptFolderPath;
    if (!this.scriptPath) {
      return;
    }
    this.scriptPath = normalizePath(this.scriptPath);
    if (!this.app.vault.getFolderByPath(this.scriptPath)) {
      return;
    }
    return getPreferredScriptFiles(
      this.app.vault
        .getFiles()
        .filter(
          (file) =>
            this.isInScriptFolder(file.path) && this.isScriptPath(file.path),
        ),
    );
  }

  async loadScripts(
    generation: number = this.scriptRegistryGeneration,
  ): Promise<void> {
    await Promise.all(
      this.getListofScripts()?.map((file) =>
        this.loadScript(file, generation),
      ) ?? [],
    );
  }

  /** Reloads the script command and toolbar registry after discovery changes. */
  public async reloadScripts(): Promise<void> {
    const generation = ++this.scriptRegistryGeneration;
    this.unloadScripts();
    await this.loadScripts(generation);
    if (generation !== this.scriptRegistryGeneration) {
      return;
    }
    getExcalidrawViews(this.app, true).forEach((view) =>
      view.updatePinnedScripts(),
    );
  }

  /**
   * Builds a non-destructive plan for moving scripts to the selected local
   * extension. A configured startup script outside the Scripts folder is
   * included. Same-named destination files are reported and skipped.
   */
  public getScriptFileMigrationPlan(
    targetExtension: ScriptFileExtension,
  ): ScriptFileRenamePlan {
    const sourceExtension = targetExtension === "js" ? "md" : "js";
    const scriptFolder = normalizePath(
      this.plugin.settings.scriptFolderPath.trim(),
    );
    const scriptFolderPrefix = scriptFolder ? `${scriptFolder}/` : "";
    const renamesBySource = new Map<
      string,
      ScriptFileRenamePlan["renames"][number]
    >();

    if (scriptFolderPrefix) {
      this.app.vault
        .getFiles()
        .filter(
          (file) =>
            file.path.startsWith(scriptFolderPrefix) &&
            file.extension.toLowerCase() === sourceExtension,
        )
        .forEach((file) => {
          renamesBySource.set(file.path, {
            file,
            sourcePath: file.path,
            destinationPath: replaceScriptFileExtension(
              file.path,
              targetExtension,
            ),
          });
        });
    }

    const resolvedStartupPath = resolveConfiguredStartupScriptPath(
      this.plugin.settings.startupScriptPath,
    );
    if (resolvedStartupPath?.toLowerCase().endsWith(`.${sourceExtension}`)) {
      const startupFile = this.app.vault.getFileByPath(resolvedStartupPath);
      if (startupFile) {
        const destinationPath = replaceScriptFileExtension(
          startupFile.path,
          targetExtension,
        );
        if (!renamesBySource.has(startupFile.path)) {
          renamesBySource.set(startupFile.path, {
            file: startupFile,
            sourcePath: startupFile.path,
            destinationPath,
          });
        }
      }
    }

    const renames: ScriptFileRenamePlan["renames"] = [];
    const conflicts: string[] = [];
    for (const rename of renamesBySource.values()) {
      if (this.app.vault.getAbstractFileByPath(rename.destinationPath)) {
        conflicts.push(rename.sourcePath);
      } else {
        renames.push(rename);
      }
    }

    return {
      renames,
      conflicts,
      includesStartupScript: Boolean(
        resolvedStartupPath &&
        renames.some(({ sourcePath }) => sourcePath === resolvedStartupPath),
      ),
    };
  }

  /**
   * Applies a previously confirmed script-extension migration. File events
   * are suppressed during the batch, pinned paths and the startup path are
   * updated atomically with settings, and completed renames are rolled back
   * if a later rename or settings write fails.
   */
  public async migrateScriptFiles(plan: ScriptFileRenamePlan): Promise<number> {
    for (const rename of plan.renames) {
      if (
        rename.file.path !== rename.sourcePath ||
        this.app.vault.getAbstractFileByPath(rename.destinationPath)
      ) {
        throw new Error(`Script migration plan is stale: ${rename.sourcePath}`);
      }
    }

    const originalPinnedScripts = [...this.plugin.settings.pinnedScripts];
    const originalStartupScriptPath = this.plugin.settings.startupScriptPath;
    const destinationBySource = new Map(
      plan.renames.map(({ sourcePath, destinationPath }) => [
        sourcePath,
        destinationPath,
      ]),
    );
    const resolvedStartupPath = resolveConfiguredStartupScriptPath(
      originalStartupScriptPath,
    );
    const completed: ScriptFileRenamePlan["renames"] = [];
    this.scriptFileEventsSuspended = true;

    try {
      for (const rename of plan.renames) {
        await this.app.fileManager.renameFile(
          rename.file,
          rename.destinationPath,
        );
        completed.push(rename);
      }

      this.plugin.settings.pinnedScripts = originalPinnedScripts.map(
        (path) => destinationBySource.get(path) ?? path,
      );
      const startupDestinationPath = resolvedStartupPath
        ? destinationBySource.get(resolvedStartupPath)
        : null;
      if (startupDestinationPath) {
        this.plugin.settings.startupScriptPath = startupDestinationPath;
      }
      await this.plugin.saveSettings();
      return completed.length;
    } catch (error: unknown) {
      this.plugin.settings.pinnedScripts = originalPinnedScripts;
      this.plugin.settings.startupScriptPath = originalStartupScriptPath;
      for (const rename of completed.reverse()) {
        try {
          await this.app.fileManager.renameFile(rename.file, rename.sourcePath);
        } catch (rollbackError: unknown) {
          errorlog({
            where: "ScriptEngine.migrateScriptFiles.rollback",
            sourcePath: rename.sourcePath,
            error: rollbackError,
          });
        }
      }
      throw error;
    } finally {
      this.scriptFileEventsSuspended = false;
      this.clearCompiledScripts();
      this.autostartAttachments = new WeakMap();
      await this.reloadScripts();
    }
  }

  /**
   * Renames one managed script to the requested local extension while keeping
   * pinned-script and startup-script paths synchronized.
   */
  public async renameManagedScriptFile(
    file: TFile,
    destinationPath: string,
  ): Promise<void> {
    const sourcePath = file.path;
    const startupScriptPath = resolveConfiguredStartupScriptPath(
      this.plugin.settings.startupScriptPath,
    );
    await this.migrateScriptFiles({
      renames: [{ file, sourcePath, destinationPath }],
      conflicts: [],
      includesStartupScript: startupScriptPath === sourcePath,
    });
  }

  public getScriptName(f: TFile | string): string {
    let basename = "";
    let path = "";
    if (f instanceof TFile) {
      basename = f.basename;
      path = f.path;
    } else {
      basename = splitFolderAndFilename(f).basename;
      path = f;
    }

    const subpath = path.split(`${this.scriptPath}/`)[1];
    if (!subpath) {
      console.warn(
        `ScriptEngine.getScriptName unexpected basename: ${basename}; path: ${path}`,
      );
    }
    const lastSlash = subpath?.lastIndexOf("/");
    if (lastSlash > -1) {
      return subpath.substring(0, lastSlash + 1) + basename;
    }
    return basename;
  }

  public getScriptFileByName(scriptName: string): TFile | null {
    return (
      this.getListofScripts()?.find(
        (file) => this.getScriptName(file) === scriptName,
      ) ?? null
    );
  }

  async addScriptIconToMap(
    scriptPath: string,
    name: string,
    generation: number = this.scriptRegistryGeneration,
  ): Promise<void> {
    const svgFilePath = getIMGFilename(scriptPath, "svg");
    const file = this.app.vault.getFileByPath(svgFilePath);
    const svgString: string = file ? await this.app.vault.read(file) : null;
    if (generation !== this.scriptRegistryGeneration) {
      return;
    }
    this.scriptIconMap = {
      ...this.scriptIconMap,
    };
    const splitname = splitFolderAndFilename(name);
    this.scriptIconMap[scriptPath] = {
      name: splitname.filename,
      group: splitname.folderpath,
      svgString,
    };
    this.updateToolPannels();
  }

  async loadScript(
    f: TFile,
    generation: number = this.scriptRegistryGeneration,
  ): Promise<void> {
    if (!this.isScriptPath(f.path)) {
      return;
    }
    const scriptName = this.getScriptName(f);
    const iconLoad = this.addScriptIconToMap(f.path, scriptName, generation);
    this.plugin.addCommand({
      id: scriptName,
      name: `(Script) ${scriptName}`,
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(
            this.app.workspace.getActiveViewOfType(ExcalidrawView),
          );
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          void this.executeScriptFile(view, f, scriptName);
          return true;
        }
        return false;
      },
    });
    this.loadedScriptPaths.add(f.path);
    await iconLoad;
  }

  unloadScripts() {
    Array.from(this.loadedScriptPaths).forEach((path) => {
      this.unloadScript(this.getScriptName(path), path);
    });
  }

  /**
   * Registers a cleanup callback for a selected-element action provider a
   * script registered via `ExcalidrawAutomate.registerElementActionProvider()`,
   * so it can be unregistered if the script's file is deleted while a view
   * using it is still open. Not needed for the ordinary view-close case,
   * which `SelectedElementActionsMenu.destroy()` already handles.
   */
  public trackElementActionProvider(
    scriptName: string,
    unregister: () => void,
  ): void {
    let providers = this.elementActionProviders.get(scriptName);
    if (!providers) {
      providers = new Set();
      this.elementActionProviders.set(scriptName, providers);
    }
    providers.add(unregister);
  }

  /**
   * Removes a script's entry from `settings.autostartScripts` and
   * `settings.autostartScriptFailures` when its file is deleted or renamed
   * away, so a stale allow/deny permission or failure flag does not linger
   * under a name that no longer resolves to any script file. A renamed
   * script starts fresh (prompts again) under its new name.
   */
  private async purgeAutostartPermission(scriptName: string): Promise<void> {
    const hasPermission = scriptName in this.plugin.settings.autostartScripts;
    const hasFailureFlag =
      scriptName in this.plugin.settings.autostartScriptFailures;
    if (!hasPermission && !hasFailureFlag) {
      return;
    }
    delete this.plugin.settings.autostartScripts[scriptName];
    delete this.plugin.settings.autostartScriptFailures[scriptName];
    await this.plugin.saveSettings();
  }

  /**
   * Records whether a script's most recent autostart run failed, so it can
   * be surfaced as a warning in the autostart settings/modal UI. Only
   * writes to disk when the flag actually changes (not on every autostart
   * run) to avoid a `saveSettings()` call every time an allow-listed
   * script runs. Purely informational: never touches `autostartScripts`
   * itself, so a failing script is never auto-removed from the allow
   * list - the user does that manually.
   */
  private async recordAutostartResult(
    scriptName: string,
    failed: boolean,
  ): Promise<void> {
    const failures = this.plugin.settings.autostartScriptFailures;
    if (Boolean(failures[scriptName]) === failed) {
      return;
    }
    if (failed) {
      failures[scriptName] = true;
    } else {
      delete failures[scriptName];
    }
    await this.plugin.saveSettings();
  }

  /**
   * Ensures one automatic attachment per script path and view. A successful
   * attachment remains recorded for that view; a failed one is removed so a
   * later automatic request can retry. Manual execution bypasses this method.
   */
  private async ensureViewAutostartAttachment(
    scriptName: string,
    file: TFile,
    view: ExcalidrawView,
    where: string,
  ): Promise<void> {
    let attachments = this.autostartAttachments.get(view);
    if (!attachments) {
      attachments = new Map();
      this.autostartAttachments.set(view, attachments);
    }
    const scriptPath = file.path;
    const existing = attachments.get(scriptPath);
    if (existing !== undefined) {
      await existing;
      return;
    }

    let succeeded = false;
    const run = (async (): Promise<void> => {
      try {
        await this.executeScriptFile(
          view,
          file,
          scriptName,
          "view-autostart",
        );
        succeeded = true;
      } catch (error: unknown) {
        errorlog({ where, scriptName, error });
      }
      try {
        await this.recordAutostartResult(scriptName, !succeeded);
      } catch (error: unknown) {
        errorlog({ where: `${where}.recordAutostartResult`, scriptName, error });
      }
    })();
    attachments.set(scriptPath, run);
    await run;
    if (!succeeded && attachments.get(scriptPath) === run) {
      attachments.delete(scriptPath);
    }
  }

  /**
   * Called by `ExcalidrawAutomate.registerAutostart()` right after a script
   * is freshly granted autostart permission, so the script attaches to
   * every other currently-open Excalidraw view immediately instead of only
   * the next time each view is opened. Reuses the same compiled-file path
   * `runAutostartScripts()` uses for newly-opened views; one script
   * failing does not affect the others.
   */
  public attachAutostartScriptToOpenViews(
    scriptName: string,
    excludeView?: ExcalidrawView,
  ): void {
    const file = this.getScriptFileByName(scriptName);
    if (!file) {
      return;
    }
    const views = getExcalidrawViews(this.app, true).filter(
      (view) => view !== excludeView,
    );
    views.forEach((view) => {
      void this.ensureViewAutostartAttachment(
        scriptName,
        file,
        view,
        "ScriptEngine.attachAutostartScriptToOpenViews",
      );
    });
  }

  /**
   * Runs every script the user has allow-listed for autostart (see
   * `ExcalidrawAutomate.registerAutostart()`) once against a newly-opened
   * view. Called from `ExcalidrawRoot.ts`'s mount effect, after the view's
   * `selectedElementActionsMenu` is ready. Fire-and-forget: does not block
   * initial render. Deliberately independent of the sidepanel autostart
   * feature (`Sidepanel.ts`, not touched) — different persisted field,
   * different trigger, different execution owner.
   */
  public runAutostartScripts(view: ExcalidrawView): void {
    const autostartScripts = this.plugin.settings.autostartScripts;
    Object.keys(autostartScripts)
      .filter((scriptName) => autostartScripts[scriptName] === "allow")
      .forEach((scriptName) => {
        const file = this.getScriptFileByName(scriptName);
        if (!file) {
          return;
        }
        void this.ensureViewAutostartAttachment(
          scriptName,
          file,
          view,
          "ScriptEngine.runAutostartScripts",
        );
      });
  }

  unloadScript(basename: string, path: string) {
    this.loadedScriptPaths.delete(path);
    delete this.scriptIconMap[path];
    this.scriptIconMap = { ...this.scriptIconMap };
    this.updateToolPannels();

    const providers = this.elementActionProviders.get(basename);
    if (providers) {
      providers.forEach((unregister) => unregister());
      this.elementActionProviders.delete(basename);
    }

    const commandId = `${PLUGIN_ID}:${basename}`;
    if (!this.app.commands.commands[commandId]) {
      return;
    }
    delete this.app.commands.commands[commandId];
  }

  /** Executes a script file through the transparent compiled-code cache. */
  public async executeScriptFile(
    view: ExcalidrawView = undefined,
    file: TFile,
    title: string,
    executionSource: ScriptExecutionSource = "manual",
  ): Promise<unknown> {
    if (!file || !title) {
      return;
    }
    const executable = await this.getCompiledScript(file);
    if (!executable) {
      return;
    }
    return this.executeExecutable(
      view,
      executable,
      title,
      file,
      executionSource,
    );
  }

  /**
   * Executes the configured startup file using the plugin-global EA while
   * sharing ScriptEngine's loading, compilation, utilities, and error path.
   */
  public async executeStartupScript(
    file: TFile,
    ea: ExcalidrawAutomate,
  ): Promise<unknown> {
    const executable = await this.getCompiledScript(file);
    if (!executable) {
      return;
    }
    return this.executeExecutable(
      undefined,
      executable,
      file.basename,
      file,
      "plugin-startup",
      ea,
      false,
      false,
    );
  }

  /**
   * Executes supplied source with a fresh EA. Raw source remains uncached
   * because drawing-onload callers pass code embedded inside another file.
   */
  public async executeScript(
    view: ExcalidrawView = undefined,
    script: string,
    title: string,
    file: TFile,
    executionSource: ScriptExecutionSource = "manual",
  ): Promise<unknown> {
    if (!script || !title) {
      return;
    }
    const executable = this.compileScript(script);
    if (!executable) {
      return;
    }
    return this.executeExecutable(
      view,
      executable,
      title,
      file,
      executionSource,
    );
  }

  private async executeExecutable(
    view: ExcalidrawView | undefined,
    executable: ScriptExecutable,
    title: string,
    file: TFile,
    executionSource: ScriptExecutionSource,
    eaOverride?: ExcalidrawAutomate,
    trackEA: boolean = true,
    setActiveScript: boolean = true,
  ): Promise<unknown> {
    //addresses the situation when after paste text element IDs are not updated to 8 characters
    //linked to onPaste save issue with the false parameter
    //The Excalidraw API can briefly be null while React replaces the canvas
    //during a view transition. This legacy save preflight is optional; script
    //execution itself must continue so view-autostart can attach to the new view.
    const scene = view?.getScene();
    if (
      scene?.elements.some(
        (el) => !el.isDeleted && el.type === "text" && el.id.length > 8,
      )
    ) {
      await view.save(false, true);
    }

    const ea = eaOverride ?? getEA(view);
    if (trackEA) {
      this.eaInstances.push(ea);
    }
    if (setActiveScript) {
      ea.activeScript = title;
    }

    const isViewAutostart = executionSource === "view-autostart";
    if (isViewAutostart) {
      this.viewAutostartEAs.add(ea);
    }
    try {
      return await executable(ea, {
        inputPrompt: (
          header: string | InputPromptOptions,
          placeholder?: string,
          value?: string,
          buttons?: ButtonDefinition[],
          lines?: number,
          displayEditorButtons?: boolean,
          customComponents?: (container: HTMLElement) => void,
          blockPointerInputOutsideModal?: boolean,
          controlsOnTop?: boolean,
          draggable?: boolean,
        ) => {
          if (typeof header === "object") {
            const options = header;
            header = options.header;
            placeholder = options.placeholder;
            value = options.value;
            buttons = options.buttons;
            lines = options.lines;
            displayEditorButtons = options.displayEditorButtons;
            customComponents = options.customComponents;
            blockPointerInputOutsideModal =
              options.blockPointerInputOutsideModal;
            controlsOnTop = options.controlsOnTop;
            draggable = options.draggable;
          }
          return ScriptEngine.inputPrompt(
            view,
            this.plugin,
            this.app,
            header,
            placeholder,
            value,
            buttons,
            lines,
            displayEditorButtons,
            customComponents,
            blockPointerInputOutsideModal,
            controlsOnTop,
            draggable,
          );
        },
        suggester: (
          displayItems: string[],
          items: unknown[],
          hint?: string,
          instructions?: Instruction[],
        ) =>
          ScriptEngine.suggester(
            this.app,
            displayItems,
            items,
            hint,
            instructions,
          ),
        scriptFile: file,
        executionSource,
      });
    } finally {
      if (isViewAutostart) {
        this.viewAutostartEAs.delete(ea);
      }
    }
  }

  private updateToolPannels() {
    const excalidrawViews = getExcalidrawViews(this.app, true);
    excalidrawViews.forEach((excalidrawView) => {
      excalidrawView.toolsPanelRef?.current?.updateScriptIconMap(
        this.scriptIconMap,
      );
    });
  }

  public static async inputPrompt(
    view: ExcalidrawView,
    plugin: ExcalidrawPlugin,
    app: App,
    header: string,
    placeholder?: string,
    value?: string,
    buttons?: ButtonDefinition[],
    lines?: number,
    displayEditorButtons?: boolean,
    customComponents?: (container: HTMLElement) => void,
    blockPointerInputOutsideModal?: boolean,
    controlsOnTop?: boolean,
    draggable: boolean = false,
  ) {
    try {
      return await GenericInputPrompt.Prompt(
        view,
        plugin,
        app,
        header,
        placeholder,
        value,
        buttons,
        lines,
        displayEditorButtons,
        customComponents,
        blockPointerInputOutsideModal,
        controlsOnTop,
        draggable,
      );
    } catch {
      return undefined;
    }
  }

  public static async suggester<T>(
    app: App,
    displayItems: string[],
    items: T[],
    hint?: string,
    instructions?: Instruction[],
  ): Promise<T | undefined> {
    try {
      return await GenericSuggester.Suggest(
        app,
        displayItems,
        items,
        hint,
        instructions,
      );
    } catch (error: unknown) {
      errorlog({
        message: "unexpected error in suggester",
        where: "ScriptEngine.suggester",
        error,
      });
      return undefined;
    }
  }
}
