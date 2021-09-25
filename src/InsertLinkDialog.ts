import { 
  App, 
  FuzzySuggestModal, 
  TFile 
} from "obsidian";
import {t} from './lang/helpers'

export class InsertLinkDialog extends FuzzySuggestModal<TFile> {
  public app: App;
  private addText: Function;
  private drawingPath: string;

  constructor(app: App) {
    super(app);
    this.app = app;
    this.limit = 20;
    this.setInstructions([{
      command: t("SELECT_FILE"),
      purpose: "",
    }]);    
    this.setPlaceholder(t("SELECT_FILE_TO_LINK"));
    this.emptyStateText = t("NO_MATCH");
  }

  getItems(): TFile[] {
    return this.app.vault.getFiles();
  }

  getItemText(item: TFile): string {
    return item.path; 
  }

  onChooseItem(item: TFile, _evt: MouseEvent | KeyboardEvent): void {
    const filepath = this.app.metadataCache.fileToLinktext(item,this.drawingPath,true);
    this.addText("[["+filepath+"]]"); 
  }

  public start(drawingPath:string, addText: Function) {
    this.addText = addText;
    this.drawingPath = drawingPath;
    this.open();
  }
}