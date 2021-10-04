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
    div.addClass("excalidraw-prompt-div");
    div.style.maxWidth = "600px";
    div.createEl('p',{text: "This version comes with tons of new features and possibilities. Please read the description in Community Plugins to find out more."});
    div.createEl('p',{text: ""} , (el) => {
      el.innerHTML = "Drawings you've created with version 1.1.x need to be converted to take advantage of the new features. You can also continue to use them in compatibility mode. "+
                            "During conversion your old *.excalidraw files will be replaced with new *.excalidraw.md files.";
    });
    div.createEl('p',{text: ""}, (el) => {//files manually follow one of two options:
      el.innerHTML = "To convert your drawings you have the following options:<br><ul>" + 
                     "<li>Click <code>CONVERT FILES</code> now to convert all of your *.excalidraw files, or if you prefer to make a backup first, then click <code>CANCEL</code>.</li>" +
                     "<li>In the Command Palette select <code>Excalidraw: Convert *.excalidraw files to *.excalidraw.md files</code></li>" + 
                     "<li>Right click an <code>*.excalidraw</code> file in File Explorer and select one of the following options to convert files one by one: <ul>"+
                     "<li><code>*.excalidraw => *.excalidraw.md</code></li>"+
                     "<li><code>*.excalidraw => *.md (Logseq compatibility)</code>. This option will retain the original *.excalidraw file next to the new Obsidian format. " +
                     "Make sure you also enable <code>Compatibility features</code> in Settings for a full solution.</li></ul></li>" +
                     "<li>Open a drawing in compatibility mode and select <code>Convert to new format</code> from the <code>Options Menu</code></li></ul>";
    });
    div.createEl('p',{text: "This message will only appear maximum 3 times in case you have *.excalidraw files in your Vault."});
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