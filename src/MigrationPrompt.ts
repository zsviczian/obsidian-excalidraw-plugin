import { App, Modal } from "obsidian";
import { t } from "./lang/helpers";
import ExcalidrawPlugin from "./main";

export class MigrationPrompt extends Modal {
  private plugin: ExcalidrawPlugin;

  constructor(app: App, plugin:ExcalidrawPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    this.titleEl.setText("Welcome to Excalidraw 1.2");       
    this.createForm();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  createForm(): void {
    const div = this.contentEl.createDiv();
    div.addClass("excalidarw-prompt-div");
    div.style.maxWidth = "600px";
    div.createEl('p',{text: "This version comes with many new features and possibilities. Please read the description in Community Plugins to find out more."});
    div.createEl('p',{text: "⚠ WARNING: Drawings you have created with version 1.1.x need to be converted, they WILL NOT WORK out of the box. "+
                            "During conversion your old *.excalidraw files will be replaced with new *.excalidraw.md files."});
    div.createEl('p',{text: "Click CONVERT to convert all of your *.excalidraw files now, or if you prefer to make a backup first, then select CANCEL."});
    div.createEl('p',{text: "To convert files manually, select 'Excalidraw: Convert *.excalidraw files to *.md files' from the Command Palette at any time in the future."});
    div.createEl('p',{text: "This message will only appear maximum 3 times."});
    const bConvert = div.createEl('button', {text: "CONVERT FILES"});
    bConvert.onclick = (ev)=>{
      this.plugin.convertExcalidrawToMD();   
      this.close();
    };
    const bCancel = div.createEl('button', {text: "CANCEL"});
    bCancel.onclick = (ev)=>{
      this.close();
    };

  }

}