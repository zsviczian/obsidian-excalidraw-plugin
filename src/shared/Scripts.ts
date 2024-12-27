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
import { ButtonDefinition, GenericInputPrompt, GenericSuggester } from "./Dialogs/Prompt";
import { getIMGFilename } from "../utils/fileUtils";
import { splitFolderAndFilename } from "../utils/fileUtils";
import { getEA } from "src/core";
import { ExcalidrawAutomate } from "../shared/ExcalidrawAutomate";
import { WeakArray } from "./WeakArray";
import { getExcalidrawViews } from "../utils/obsidianUtils";

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
        ea.destroy();
      }
    });
    this.eaInstances.removeObjects(eas);
  }

  public destroy() {
    this.eaInstances.forEach((ea) => ea.destroy());
    this.eaInstances.clear();
    this.eaInstances = null;
    this.scriptIconMap = null;
    this.plugin = null;
    this.scriptPath = null;
  }

  private handleSvgFileChange (path: string) {
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

  private async deleteEventHandler (file: TFile) {
    if (!(file instanceof TFile)) {
      return;
    }
    if (!file.path.startsWith(this.scriptPath)) {
      return;
    }
    this.unloadScript(this.getScriptName(file), file.path);
    this.handleSvgFileChange(file.path);
  };

  private async createEventHandler (file: TFile) {
    if (!(file instanceof TFile)) {
      return;
    }
    if (!file.path.startsWith(this.scriptPath)) {
      return;
    }
    this.loadScript(file);
    this.handleSvgFileChange(file.path);
  };

  private async renameEventHandler (file: TAbstractFile, oldPath: string) {
    if (!(file instanceof TFile)) {
      return;
    }
    const oldFileIsScript = oldPath.startsWith(this.scriptPath);
    const newFileIsScript = file.path.startsWith(this.scriptPath);
    if (oldFileIsScript) {
      this.unloadScript(this.getScriptName(oldPath), oldPath);
      this.handleSvgFileChange(oldPath);
    }
    if (newFileIsScript) {
      this.loadScript(file);
      this.handleSvgFileChange(file.path);
    }
  }

  registerEventHandlers() {
    this.plugin.registerEvent(
      this.app.vault.on(
        "delete",
        (file: TFile)=>this.deleteEventHandler(file)
      ),
    );
    this.plugin.registerEvent(
      this.app.vault.on(
        "create",
        (file: TFile)=>this.createEventHandler(file)
      ),
    );
    this.plugin.registerEvent(
      this.app.vault.on(
        "rename",
        (file: TAbstractFile, oldPath: string)=>this.renameEventHandler(file, oldPath)
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
    if(!this.scriptPath) return;
    this.scriptPath = normalizePath(this.scriptPath);
    if (!this.app.vault.getAbstractFileByPath(this.scriptPath)) {
      return;
    }
    return this.app.vault
      .getFiles()
      .filter(
        (f: TFile) =>
          f.path.startsWith(this.scriptPath+"/") && f.extension === "md",
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
    if(!subpath) {
      console.warn(`ScriptEngine.getScriptName unexpected basename: ${basename}; path: ${path}`)
    }
    const lastSlash = subpath?.lastIndexOf("/");
    if (lastSlash > -1) {
      return subpath.substring(0, lastSlash + 1) + basename;
    }
    return basename;
  }

  async addScriptIconToMap(scriptPath: string, name: string) {
    const svgFilePath = getIMGFilename(scriptPath, "svg");
    const file = this.app.vault.getAbstractFileByPath(svgFilePath);
    const svgString: string =
      file && file instanceof TFile
        ? await this.app.vault.read(file)
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
          return Boolean(this.app.workspace.getActiveViewOfType(ExcalidrawView));
        }
        const view = this.app.workspace.getActiveViewOfType(ExcalidrawView);
        if (view) {
          (async()=>{
            const script = await this.app.vault.read(f);
            if(script) {
              //remove YAML frontmatter if present
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
    const scripts = this.app.vault
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
    if (!this.app.commands.commands[commandId]) {
      return;
    }
    // @ts-ignore
    delete this.app.commands.commands[commandId];
  }

  async executeScript(view: ExcalidrawView, script: string, title: string, file: TFile) {
    if (!view || !script || !title) {
      return;
    }
    //addresses the situation when after paste text element IDs are not updated to 8 characters
    //linked to onPaste save issue with the false parameter
    if(view.getScene().elements.some(el=>!el.isDeleted && el.type === "text" && el.id.length > 8)) {
      await view.save(false, true);
    }

    script = script.replace(/^---.*?---\n/gs, "");
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
          this.app,
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
          this.app,
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
    return result;
}

  private updateToolPannels() {
    const excalidrawViews = getExcalidrawViews(this.app);
    excalidrawViews.forEach(excalidrawView => {
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
