import { 
  App, 
  FuzzySuggestModal, 
  TFile 
} from "obsidian";
import ExcalidrawPlugin from './main';
import {
  EMPTY_MESSAGE,
} from './constants';
import {t} from './lang/helpers'

export enum openDialogAction {
  openFile,
  insertLinkToDrawing,
  insertLink
}

export class OpenFileDialog extends FuzzySuggestModal<TFile> {
  public app: App;
  private plugin: ExcalidrawPlugin;
  private action: openDialogAction;
  private onNewPane: boolean;
  private addText: Function;
  private drawingPath: string;

  constructor(app: App, plugin: ExcalidrawPlugin) {
    super(app);
    this.app = app;
    this.action = openDialogAction.openFile;
    this.plugin = plugin;
    this.onNewPane = false;
    
    this.inputEl.onkeyup = (e) => {
      if(e.key=="Enter" && this.action == openDialogAction.openFile) {
        if (this.containerEl.innerText.includes(EMPTY_MESSAGE)) {
          this.plugin.createDrawing(this.plugin.settings.folder+'/'+this.inputEl.value+'.md', this.onNewPane);
          this.close();
        }
      }
    };
  }

  getItems(): TFile[] {
    const excalidrawFiles = this.app.vault.getFiles();
    return (excalidrawFiles || []).filter((f:TFile) => {
      if (this.action == openDialogAction.insertLink) return true;
      return this.plugin.isExcalidrawFile(f);
    });
  }

  getItemText(item: TFile): string {
    return item.path; 
  }

  onChooseItem(item: TFile, _evt: MouseEvent | KeyboardEvent): void {
    switch(this.action) {
      case(openDialogAction.openFile):
        this.plugin.openDrawing(item, this.onNewPane);
        break;
      case(openDialogAction.insertLinkToDrawing):
        this.plugin.embedDrawing(item.path);
        break;
      case(openDialogAction.insertLink):
        //TO-DO
        //change to this.app.metadataCache.fileToLinktext(file: TFile, sourcePath: string, omitMdExtension?: boolean): string;
        
        //@ts-ignore
        const filepath = this.app.metadataCache.getLinkpathDest(item.path,this.drawingPath)[0].path;
        this.addText("[["+(filepath.endsWith(".md")?filepath.substr(0,filepath.length-3):filepath)+"]]"); //.md files don't need the extension
        break;
    }
  }

  public insertLink(drawingPath:string, addText: Function) {
    this.action = openDialogAction.insertLink;
    this.addText = addText;
    this.drawingPath = drawingPath;
    this.setInstructions([{
      command: t("SELECT_FILE"),
      purpose: "",
    }]);
    this.emptyStateText = t("NO_MATCH");
    this.setPlaceholder(t("SELECT_FILE_TO_LINK"));
    this.open();
  }

  public start(action:openDialogAction, onNewPane: boolean): void {
    this.setInstructions([{
      command: t("TYPE_FILENAME"),
      purpose: "",
    }]);
    this.action = action;
    this.onNewPane = onNewPane;
    switch(action) {
      case (openDialogAction.openFile):
        this.emptyStateText = EMPTY_MESSAGE;
        this.setPlaceholder(t("SELECT_FILE_OR_TYPE_NEW"));
        break;
      case (openDialogAction.insertLinkToDrawing):
        this.emptyStateText = t("NO_MATCH");
        this.setPlaceholder(t("SELECT_TO_EMBED"));
        break;
    }
    this.open();
  }

}