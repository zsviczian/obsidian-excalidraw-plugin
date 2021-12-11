import { App, TAbstractFile, TFile } from "obsidian";
import { VIEW_TYPE_EXCALIDRAW } from "./constants";
import ExcalidrawView from "./ExcalidrawView";
import ExcalidrawPlugin from "./main";
import GenericInputPrompt from "./Prompt";
import { splitFolderAndFilename } from "./Utils";

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
      this.unloadScript(file.basename);
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
      if(oldFileIsScript) {
        this.unloadScript(splitFolderAndFilename(oldPath).basename);
      }
      if(newFileIsScript) {
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
    this.unloadScripts();
    this.loadScripts();
  }

  loadScripts() {
    const app = this.plugin.app;
    this.scriptPath = this.plugin.settings.scriptFolderPath;
    const scripts = app.vault
      .getFiles()
      .filter((f: TFile) => f.path.startsWith(this.scriptPath));
    scripts.forEach((f) => this.loadScript(f));
  }

  loadScript(f: TFile) {
    this.plugin.addCommand({
      id: f.basename,
      name: "(Script) " + f.basename,
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
    scripts.forEach((f) => this.unloadScript(f.basename));
  }

  unloadScript(basename: string) {
    const app = this.plugin.app;
    const commandId = `obsidian-excalidraw-plugin:${basename}`;
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

    //https://stackoverflow.com/questions/45381204/get-asyncfunction-constructor-in-typescript changed tsconfig to es2017
    //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

    return await new AsyncFunction("ea", "utils", script)(this.plugin.ea, {
      inputPrompt: (header: string, placeholder?: string, value?: string) =>
        ScriptEngine.inputPrompt(this.plugin.app, header, placeholder, value),
    });
  }

  public static async inputPrompt(
    app: App,
    header: string,
    placeholder?: string,
    value?: string,
  ) {
    try {
      return await GenericInputPrompt.Prompt(app, header, placeholder, value);
    } catch {
      return undefined;
    }
  }
}
