import { App, Instruction, Notice, TAbstractFile, TFile } from "obsidian";
import { PLUGIN_ID, VIEW_TYPE_EXCALIDRAW } from "./constants";
import ExcalidrawView from "./ExcalidrawView";
import { t } from "./lang/helpers";
import ExcalidrawPlugin from "./main";
import { GenericInputPrompt, GenericSuggester } from "./Prompt";
import { errorlog, splitFolderAndFilename } from "./Utils";

export class ScriptEngine {
  private plugin: ExcalidrawPlugin;
  private scriptPath: string;

  constructor(plugin: ExcalidrawPlugin) {
    this.plugin = plugin;
    this.loadScripts();
    this.registerEventHandlers();
  }

  registerEventHandlers() {
    const deleteEventHandler = async (file: TFile) => {
      if (!(file instanceof TFile)) {
        return;
      }
      if (!file.path.startsWith(this.scriptPath)) {
        return;
      }
      this.unloadScript(this.getScriptName(file));
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
        this.unloadScript(this.getScriptName(oldPath));
      }
      if (newFileIsScript) {
        this.loadScript(file);
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
      .filter((f: TFile) => f.path.startsWith(this.scriptPath));
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

  loadScript(f: TFile) {
    const scriptName = this.getScriptName(f);
    this.plugin.addCommand({
      id: scriptName,
      name: `(Script) ${scriptName}`,
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            this.plugin.app.workspace.activeLeaf.view.getViewType() ==
            VIEW_TYPE_EXCALIDRAW
          );
        }
        const view = this.plugin.app.workspace.activeLeaf.view;
        if (view instanceof ExcalidrawView) {
          this.executeScript(view, f);
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
      this.unloadScript(this.getScriptName(f));
    });
  }

  unloadScript(basename: string) {
    const app = this.plugin.app;
    const commandId = `${PLUGIN_ID}:${basename}`;
    // @ts-ignore
    if (!app.commands.commands[commandId]) {
      return;
    }
    // @ts-ignore
    delete app.commands.commands[commandId];
  }

  async executeScript(view: ExcalidrawView, f: TFile) {
    if (!view || !f) {
      return;
    }
    this.plugin.ea.reset();
    this.plugin.ea.setView(view);
    const script = await this.plugin.app.vault.read(f);
    if (!script) {
      return;
    }

    this.plugin.ea.activeScript = this.getScriptName(f);

    //https://stackoverflow.com/questions/45381204/get-asyncfunction-constructor-in-typescript changed tsconfig to es2017
    //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
    let result = null;
    //try {
      result = await new AsyncFunction("ea", "utils", script)(this.plugin.ea, {
        inputPrompt: (header: string, placeholder?: string, value?: string, buttons?: [{caption:string, action:Function}]) =>
          ScriptEngine.inputPrompt(this.plugin.app, header, placeholder, value, buttons),
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

  public static async inputPrompt(
    app: App,
    header: string,
    placeholder?: string,
    value?: string,
    buttons?: [{caption:string, action:Function}],
  ) {
    try {
      return await GenericInputPrompt.Prompt(app, header, placeholder, value, buttons);
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
