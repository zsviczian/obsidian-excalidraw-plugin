import {
  App,
  Instruction,
  TAbstractFile,
  TFile,
  WorkspaceLeaf,
} from "obsidian";
import { PLUGIN_ID, VIEW_TYPE_EXCALIDRAW } from "./constants";
import ExcalidrawView from "./ExcalidrawView";
import ExcalidrawPlugin from "./main";
import { ButtonDefinition, GenericInputPrompt, GenericSuggester } from "./dialogs/Prompt";
import { getIMGFilename } from "./utils/FileUtils";
import { splitFolderAndFilename } from "./utils/FileUtils";
import { getEA } from "src";

export type ScriptIconMap = {
  [key: string]: { name: string; group: string; svgString: string };
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
      const scriptFile = app.vault.getAbstractFileByPath(
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
      app.vault.on("delete", deleteEventHandler),
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
      app.vault.on("create", createEventHandler),
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
      app.vault.on("rename", renameEventHandler),
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
    const file = app.vault.getAbstractFileByPath(svgFilePath);
    const svgString: string =
      file && file instanceof TFile
        ? await app.vault.read(file)
        : null;
    this.scriptIconMap = {
      ...this.scriptIconMap,
    };
    const splitname = splitFolderAndFilename(name)
    this.scriptIconMap[scriptPath] = { name:splitname.filename, group: splitname.folderpath === "/" ? "" : splitname.folderpath, svgString };
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
            const script = await app.vault.read(f);
            if(script) {
              this.executeScript(view, script, scriptName,f);
            }
          })()
          return true;
        }
        return false;
      },
    });
  }

  unloadScripts() {
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

    const commandId = `${PLUGIN_ID}:${basename}`;
    // @ts-ignore
    if (!this.plugin.app.commands.commands[commandId]) {
      return;
    }
    // @ts-ignore
    delete this.plugin.app.commands.commands[commandId];
  }

  async executeScript(view: ExcalidrawView, script: string, title: string, file: TFile) {
    if (!view || !script || !title) {
      return;
    }
    const ea = getEA(view);
    ea.activeScript = title;

    //https://stackoverflow.com/questions/45381204/get-asyncfunction-constructor-in-typescript changed tsconfig to es2017
    //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
    let result = null;
    //try {
    result = await new AsyncFunction("ea", "utils", script)(ea, {
      inputPrompt: (
        header: string,
        placeholder?: string,
        value?: string,
        buttons?: ButtonDefinition[],
        lines?: number,
        displayEditorButtons?: boolean,
        customComponents?: (container: HTMLElement) => void,
        blockPointerInputOutsideModal?: boolean,
      ) =>
        ScriptEngine.inputPrompt(
          view,
          this.plugin,
          this.plugin.app,
          header,
          placeholder,
          value,
          buttons,
          lines,
          displayEditorButtons,
          customComponents,
          blockPointerInputOutsideModal,
        ),
      suggester: (
        displayItems: string[],
        items: any[],
        hint?: string,
        instructions?: Instruction[],
      ) =>
        ScriptEngine.suggester(
          app,
          displayItems,
          items,
          hint,
          instructions,
        ),
      scriptFile: file
    });
    /*} catch (e) {
      new Notice(t("SCRIPT_EXECUTION_ERROR"), 4000);
      errorlog({ script: this.plugin.ea.activeScript, error: e });
  }*/
        ea.activeScript = null;
        return result;
}

  private updateToolPannels() {
    const leaves =
      app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW);
    leaves.forEach((leaf: WorkspaceLeaf) => {
      const excalidrawView = leaf.view as ExcalidrawView;
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
