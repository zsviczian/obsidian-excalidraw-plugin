import { App, FuzzySuggestModal, TFile, TFolder, normalizePath, Vault, TAbstractFile, Instruction } from "obsidian";
import ExcalidrawPlugin from './main';
import ExcalidrawView from './view';

export class OpenFileDialog extends FuzzySuggestModal<TFile> {
  public app: App;
  private plugin: ExcalidrawPlugin;

  constructor(app: App, plugin: ExcalidrawPlugin) {
    super(app);
    this.app = app;
    this.plugin = plugin;
    const EMPTY_MESSAGE = "Hit enter to create a new drawing";
    this.emptyStateText = EMPTY_MESSAGE;
    this.setInstructions([{
      command: "Select an existing drawing or type title for your new drawing, then hit enter.",
      purpose: "The new drawing will be created in the default Excalidraw folder specified in Settings.",
    }]);
    
    this.inputEl.onkeyup = (e) => {
      if(e.key=="Enter") {
        if (this.containerEl.innerText.includes(EMPTY_MESSAGE)) {
          this.plugin.createDrawing(this.plugin.settings.folder+'/'+this.inputEl.value+'.excalidraw');
          this.close();
        }
      }
    };
  }

  getItems(): TFile[] {
    let excalidrawFiles: TFile[] = [];
    excalidrawFiles = this.app.vault.getFiles();
    return excalidrawFiles.filter((f:TFile) => (f.extension=='excalidraw'));
  }

  getItemText(item: TFile): string {
    return item.basename;
  }

  onChooseItem(item: TFile, _evt: MouseEvent | KeyboardEvent): void {
    this.plugin.openDrawing(item);
  }

  start(): void {
    try {
      let files = this.getItems();
      this.open();
    }
    catch(error) {
      console.log(error);
    }
  }

}