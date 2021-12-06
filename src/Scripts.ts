import { App, normalizePath, TAbstractFile, TFile } from "obsidian";
import { VIEW_TYPE_EXCALIDRAW } from "./constants";
import ExcalidrawView from "./ExcalidrawView";
import ExcalidrawPlugin from "./main";
import { splitFolderAndFilename } from "./Utils";

export class ScriptEngine {
  private plugin:ExcalidrawPlugin;
  private scriptPath:string;

  constructor(plugin: ExcalidrawPlugin) {
    this.plugin = plugin;
    this.loadScripts();
    this.registerEventHandlers();
  }

  registerEventHandlers() {
    const deleteEventHandler = async (file:TFile) => {
      if (!(file instanceof TFile)) return;
      if (file.path !== this.scriptPath) return;
      this.unloadScript(file.basename);
    }
    this.plugin.registerEvent(
      this.plugin.app.vault.on("delete",deleteEventHandler)
    );

    const createEventHandler = async (file:TFile) => {
      if (!(file instanceof TFile)) return;     
      if (file.path !== this.scriptPath) return;
      this.loadScript(file);
    }
    this.plugin.registerEvent(
      this.plugin.app.vault.on("create",createEventHandler)
    );

    const renameEventHandler = async (file:TAbstractFile,oldPath:string)  => {
      if (!(file instanceof TFile)) return;     
      if (file.path !== this.scriptPath) return;
      this.unloadScript(splitFolderAndFilename(oldPath).basename);
      this.loadScript(file);
    }
    this.plugin.registerEvent(
      this.plugin.app.vault.on("rename",renameEventHandler)
    );
  }

  updateScriptPath() {
    if(this.scriptPath === this.plugin.settings.scriptFolderPath) return;
    this.unloadScripts();
    this.loadScripts();
  }

  loadScripts() {
    const app = this.plugin.app;
    this.scriptPath = this.plugin.settings.scriptFolderPath;
    const scripts = app.vault.getFiles().filter((f:TFile)=>f.path === normalizePath(this.scriptPath+"/"+f.name));
    scripts.forEach((f)=>this.loadScript(f));
  }

  loadScript(f:TFile) {
    this.plugin.addCommand({
      id: f.basename,
      name: f.basename,
      checkCallback: (checking: boolean) => {
        if (checking) {
          return this.plugin.app.workspace.activeLeaf.view.getViewType() == VIEW_TYPE_EXCALIDRAW;
        } else {
          const view = this.plugin.app.workspace.activeLeaf.view;
          if (view instanceof ExcalidrawView) {
            this.executeScript(view,f);
            return true;
          }
          else return false;
        }
      },
    });
  }

  unloadScripts() {
    const app = this.plugin.app;
    const scripts = app.vault.getFiles().filter((f:TFile)=>f.path === normalizePath(this.scriptPath+"/"+f.name));
    scripts.forEach((f)=>this.unloadScript(f.basename));

  }

  unloadScript(basename: string) {
    const app = this.plugin.app;
    const commandId = "obsidian-excalidraw-plugin:"+basename;
    // @ts-ignore
    if (!app.commands.commands[commandId]) return;
    // @ts-ignore
    delete app.commands.commands[commandId];
  }

  async executeScript(view:ExcalidrawView,f:TFile) {
    if(!view || !f) return;
    this.plugin.ea.reset();
    this.plugin.ea.setView(view);
    const script = "ea=ExcalidrawAutomate;\n" + await this.plugin.app.vault.read(f);
    if(!script) return;
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    return await new AsyncFunction(script)();
  }
}
