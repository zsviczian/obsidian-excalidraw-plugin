import {
  App,
  Instruction,
  TAbstractFile,
  TFile,
  WorkspaceLeaf,
} from "obsidian";
import { PLUGIN_ID, VIEW_TYPE_EXCALIDRAW } from "./Constants";
import ExcalidrawView from "./ExcalidrawView";
import ExcalidrawPlugin from "./main";
import { GenericInputPrompt, GenericSuggester } from "./dialogs/Prompt";
import { getIMGFilename } from "./utils/FileUtils";
import { splitFolderAndFilename } from "./utils/FileUtils";

export type ScriptIconMap = {
  [key: string]: { name: string; svgString: string };
};

export class ScriptEngine {
  private plugin: ExcalidrawPlugin;
  private scriptPath: string;
  //https://stackoverflow.com/questions/60218638/how-to-force-re-render-if-map-value-changes
  public scriptIconMap: ScriptIconMap;

  constructor(plugin: ExcalidrawPlugin) {
    this.plugin = plugin;
    this.scriptIconMap = {};
    this.loadScripts();
    this.registerEventHandlers();
  }

  registerEventHandlers() {
    const handleSvgFileChange = (path: string) => {
      if (!path.endsWith(".svg")) {
        return;
      }
      const scriptFile = this.plugin.app.vault.getAbstractFileByPath(
        getIMGFilename(path, "md"),
      );
      if (scriptFile && scriptFile instanceof TFile) {
        this.unloadScript(this.getScriptName(scriptFile), scriptFile.path);
        this.loadScript(scriptFile);
      }
    };
    const deleteEventHandler = async (file: TFile) => {
      if (!(file instanceof TFile)) {
        return;
      }
      if (!file.path.startsWith(this.scriptPath)) {
        return;
      }
      this.unloadScript(this.getScriptName(file), file.path);
      handleSvgFileChange(file.path);
    };
    this.plugin.registerEvent(
      this.plugin.app.vault.on("delete", deleteEventHandler),
    );

    const createEventHandler = async (file: TFile) => {
      if (!(file instanceof TFile)) {
        return;
      }
      if (!file.path.startsWith(this.scriptPath)) {
        return;
      }
      this.loadScript(file);
      handleSvgFileChange(file.path);
    };
    this.plugin.registerEvent(
      this.plugin.app.vault.on("create", createEventHandler),
    );

    const renameEventHandler = async (file: TAbstractFile, oldPath: string) => {
      if (!(file instanceof TFile)) {
        return;
      }
      const oldFileIsScript = oldPath.startsWith(this.scriptPath);
      const newFileIsScript = file.path.startsWith(this.scriptPath);
      if (oldFileIsScript) {
        this.unloadScript(this.getScriptName(oldPath), oldPath);
        handleSvgFileChange(oldPath);
      }
      if (newFileIsScript) {
        this.loadScript(file);
        handleSvgFileChange(file.path);
      }
    };
    this.plugin.registerEvent(
      this.plugin.app.vault.on("rename", renameEventHandler),
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
    const app = this.plugin.app;
    this.scriptPath = this.plugin.settings.scriptFolderPath;
    if (!app.vault.getAbstractFileByPath(this.scriptPath)) {
      this.scriptPath = null;
      return;
    }
    return app.vault
      .getFiles()
      .filter(
        (f: TFile) =>
          f.path.startsWith(this.scriptPath) && f.extension === "md",
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
    const lastSlash = subpath.lastIndexOf("/");
    if (lastSlash > -1) {
      return subpath.substring(0, lastSlash + 1) + basename;
    }
    return basename;
  }

  async addScriptIconToMap(scriptPath: string, name: string) {
    const svgFilePath = getIMGFilename(scriptPath, "svg");
    const file = this.plugin.app.vault.getAbstractFileByPath(svgFilePath);
    const svgString: string =
      file && file instanceof TFile
        ? await this.plugin.app.vault.read(file)
        : null;
    this.scriptIconMap = {
      ...this.scriptIconMap,
    };
    this.scriptIconMap[scriptPath] = { name, svgString };
    this.updateToolPannels();
  }

  loadScript(f: TFile) {
    if (f.extension !== "md") {
      return;
    }
    const scriptName = this.getScriptName(f);
    this.addScriptIconToMap(f.path, scriptName);
    this.plugin.addCommand({
      id: scriptName,
      name: `(Script) ${scriptName}`,
      checkCallback: (checking: boolean) => {
        if (checking) {
          return Boolean(app.workspace.getActiveViewOfType(ExcalidrawView));
        }
        const view = app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          (async()=>{
            const script = await this.plugin.app.vault.read(f);
            if(script) {
              this.executeScript(view, script, scriptName);
            }
          })()
          return true;
        }
        return false;
      },
    });
  }

  unloadScripts() {
    const app = this.plugin.app;
    const scripts = app.vault
      .getFiles()
      .filter((f: TFile) => f.path.startsWith(this.scriptPath));
    scripts.forEach((f) => {
      this.unloadScript(this.getScriptName(f), f.path);
    });
  }

  unloadScript(basename: string, path: string) {
    if (!path.endsWith(".md")) {
      return;
    }
    delete this.scriptIconMap[path];
    this.scriptIconMap = { ...this.scriptIconMap };
    this.updateToolPannels();

    const app = this.plugin.app;
    const commandId = `${PLUGIN_ID}:${basename}`;
    // @ts-ignore
    if (!app.commands.commands[commandId]) {
      return;
    }
    // @ts-ignore
    delete app.commands.commands[commandId];
  }

  async executeScript(view: ExcalidrawView, script: string, title: string) {
    if (!view || !script || !title) {
      return;
    }
    this.plugin.ea.reset();
    this.plugin.ea.setView(view);
    this.plugin.ea.activeScript = title;

    //https://stackoverflow.com/questions/45381204/get-asyncfunction-constructor-in-typescript changed tsconfig to es2017
    //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
    let result = null;
    //try {
    result = await new AsyncFunction("ea", "utils", script)(this.plugin.ea, {
      inputPrompt: (
        header: string,
        placeholder?: string,
        value?: string,
        buttons?: [{ caption: string; action: Function }],
      ) =>
        ScriptEngine.inputPrompt(
          this.plugin.app,
          header,
          placeholder,
          value,
          buttons,
        ),
      suggester: (
        displayItems: string[],
        items: any[],
        hint?: string,
        instructions?: Instruction[],
      ) =>
        ScriptEngine.suggester(
          this.plugin.app,
          displayItems,
          items,
          hint,
          instructions,
        ),
    });
    /*} catch (e) {
      new Notice(t("SCRIPT_EXECUTION_ERROR"), 4000);
      errorlog({ script: this.plugin.ea.activeScript, error: e });
    }*/
    this.plugin.ea.activeScript = null;
    return result;
  }

  private updateToolPannels() {
    const leaves =
      this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
    leaves.forEach((leaf: WorkspaceLeaf) => {
      const excalidrawView = leaf.view as ExcalidrawView;
      excalidrawView.toolsPanelRef?.current?.updateScriptIconMap(
        this.scriptIconMap,
      );
    });
  }

  public static async inputPrompt(
    app: App,
    header: string,
    placeholder?: string,
    value?: string,
    buttons?: [{ caption: string; action: Function }],
  ) {
    try {
      return await GenericInputPrompt.Prompt(
        app,
        header,
        placeholder,
        value,
        buttons,
      );
    } catch {
      return undefined;
    }
  }

  public static async suggester(
    app: App,
    displayItems: string[],
    items: any[],
    hint?: string,
    instructions?: Instruction[],
  ) {
    try {
      return await GenericSuggester.Suggest(
        app,
        displayItems,
        items,
        hint,
        instructions,
      );
    } catch (e) {
      return undefined;
    }
  }
}
