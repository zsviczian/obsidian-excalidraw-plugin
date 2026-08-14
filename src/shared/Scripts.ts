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

export type ScriptIconMap = {
  [key: string]: { name: string; group: string; svgString: string };
};

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

  constructor(plugin: ExcalidrawPlugin) {
    this.plugin = plugin;
    this.app = plugin.app;
    this.scriptIconMap = {};
    this.loadScripts();
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
    this.scriptIconMap = null;
    this.plugin = null;
    this.scriptPath = null;
  }

  private handleSvgFileChange(path: string) {
    if (!path.endsWith(".svg")) {
      return;
    }
    const scriptFile = this.app.vault.getAbstractFileByPath(
      getIMGFilename(path, "md"),
    );
    if (scriptFile && scriptFile instanceof TFile) {
      this.unloadScript(this.getScriptName(scriptFile), scriptFile.path);
      this.loadScript(scriptFile);
    }
  }

  private async deleteEventHandler(file: TFile) {
    if (!(file instanceof TFile)) {
      return;
    }
    if (!file.path.startsWith(this.scriptPath)) {
      return;
    }
    const scriptName = this.getScriptName(file);
    this.unloadScript(scriptName, file.path);
    await this.purgeAutostartPermission(scriptName);
    this.handleSvgFileChange(file.path);
  }

  private async createEventHandler(file: TFile) {
    if (!(file instanceof TFile)) {
      return;
    }
    if (!file.path.startsWith(this.scriptPath)) {
      return;
    }
    this.loadScript(file);
    this.handleSvgFileChange(file.path);
  }

  private async renameEventHandler(file: TAbstractFile, oldPath: string) {
    if (!(file instanceof TFile)) {
      return;
    }
    const oldFileIsScript = oldPath.startsWith(this.scriptPath);
    const newFileIsScript = file.path.startsWith(this.scriptPath);
    if (oldFileIsScript) {
      const oldScriptName = this.getScriptName(oldPath);
      this.unloadScript(oldScriptName, oldPath);
      await this.purgeAutostartPermission(oldScriptName);
      this.handleSvgFileChange(oldPath);
    }
    if (newFileIsScript) {
      this.loadScript(file);
      this.handleSvgFileChange(file.path);
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
  }

  updateScriptPath() {
    if (this.scriptPath === this.plugin.settings.scriptFolderPath) {
      return;
    }
    if (this.scriptPath) {
      this.unloadScripts();
    }
    this.loadScripts();
  }

  public getListofScripts(): TFile[] {
    this.scriptPath = this.plugin.settings.scriptFolderPath;
    if (!this.scriptPath) {
      return;
    }
    this.scriptPath = normalizePath(this.scriptPath);
    if (!this.app.vault.getAbstractFileByPath(this.scriptPath)) {
      return;
    }
    return this.app.vault
      .getFiles()
      .filter(
        (f: TFile) =>
          f.path.startsWith(`${this.scriptPath}/`) && f.extension === "md",
      );
  }

  loadScripts() {
    this.getListofScripts()?.forEach((f) => this.loadScript(f));
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

  async addScriptIconToMap(scriptPath: string, name: string) {
    const svgFilePath = getIMGFilename(scriptPath, "svg");
    const file = this.app.vault.getAbstractFileByPath(svgFilePath);
    const svgString: string =
      file && file instanceof TFile ? await this.app.vault.read(file) : null;
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

  loadScript(f: TFile) {
    if (f.extension !== "md") {
      return;
    }
    const scriptName = this.getScriptName(f);
    void this.addScriptIconToMap(f.path, scriptName);
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
          void (async () => {
            const script = stripYamlFrontmatter(await this.app.vault.read(f));
            if (script) {
              await this.executeScript(view, script, scriptName, f);
            }
          })();
          return true;
        }
        return false;
      },
    });
  }

  unloadScripts() {
    const scripts = this.app.vault
      .getFiles()
      .filter((f: TFile) => f.path.startsWith(this.scriptPath));
    scripts.forEach((f) => {
      this.unloadScript(this.getScriptName(f), f.path);
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
   * Reads and executes a single autostart-permitted script against a single
   * view, catching and logging its own error so one bad script never
   * affects the caller's other scripts/views. Shared by
   * `attachAutostartScriptToOpenViews()` and `runAutostartScripts()`.
   */
  private async runAutostartScriptInView(
    scriptName: string,
    file: TFile,
    view: ExcalidrawView,
    where: string,
  ): Promise<void> {
    try {
      const script = stripYamlFrontmatter(await this.app.vault.read(file));
      if (script) {
        await this.executeScript(view, script, scriptName, file);
      }
      await this.recordAutostartResult(scriptName, false);
    } catch (error: unknown) {
      errorlog({ where, scriptName, error });
      await this.recordAutostartResult(scriptName, true);
    }
  }

  /**
   * Called by `ExcalidrawAutomate.registerAutostart()` right after a script
   * is freshly granted autostart permission, so the script attaches to
   * every other currently-open Excalidraw view immediately instead of only
   * the next time each view is opened. Reuses the same `executeScript()`
   * path `runAutostartScripts()` uses for newly-opened views; one script
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
      void this.runAutostartScriptInView(
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
        void this.runAutostartScriptInView(
          scriptName,
          file,
          view,
          "ScriptEngine.runAutostartScripts",
        );
      });
  }

  unloadScript(basename: string, path: string) {
    if (!path.endsWith(".md")) {
      return;
    }
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

  async executeScript(
    view: ExcalidrawView = undefined,
    script: string,
    title: string,
    file: TFile,
  ) {
    if (!script || !title) {
      return;
    }
    //addresses the situation when after paste text element IDs are not updated to 8 characters
    //linked to onPaste save issue with the false parameter
    if (
      view &&
      view
        .getScene()
        .elements.some(
          (el) => !el.isDeleted && el.type === "text" && el.id.length > 8,
        )
    ) {
      await view.save(false, true);
    }

    script = stripYamlFrontmatter(script);
    const ea = getEA(view);
    this.eaInstances.push(ea);
    ea.activeScript = title;

    //https://stackoverflow.com/questions/45381204/get-asyncfunction-constructor-in-typescript changed tsconfig to es2017
    //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
    let result = null;
    //try {
    result = await new AsyncFunction("ea", "utils", script)(ea, {
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
          blockPointerInputOutsideModal = options.blockPointerInputOutsideModal;
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
    });
    /*} catch (e) {
      new Notice(t("SCRIPT_EXECUTION_ERROR"), 4000);
      errorlog({ script: this.plugin.ea.activeScript, error: e });
  }*/
    return result;
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
