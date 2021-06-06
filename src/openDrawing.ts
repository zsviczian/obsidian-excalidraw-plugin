import { 
  App, 
  FuzzySuggestModal, 
  TFile 
} from "obsidian";
import ExcalidrawPlugin from './main';
import {
  EMPTY_MESSAGE,
  EXCALIDRAW_FILE_EXTENSION
} from './constants';

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
          this.plugin.createDrawing(this.plugin.settings.folder+'/'+this.inputEl.value+'.'+EXCALIDRAW_FILE_EXTENSION, this.onNewPane);
          this.close();
        }
      }
    };
  }

  getItems(): TFile[] {
    const excalidrawFiles = this.app.vault.getFiles();
    return (excalidrawFiles || []).filter((f:TFile) => (this.action == openDialogAction.insertLink) || (f.extension==EXCALIDRAW_FILE_EXTENSION));
  }

  getItemText(item: TFile): string {
    return item.path; //this.action == openDialogAction.insertLink ? item.path : item.basename;
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
      command: "Select a file then hit enter.",
      purpose: "",
    }]);
    this.emptyStateText = "No file matches your query.";
    this.setPlaceholder("Select existing file to insert link into drawing.");
    this.open();
  }

  public start(action:openDialogAction, onNewPane: boolean): void {
    this.setInstructions([{
      command: "Type name of drawing to select.",
      purpose: "",
    }]);
    this.action = action;
    this.onNewPane = onNewPane;
    switch(action) {
      case (openDialogAction.openFile):
        this.emptyStateText = EMPTY_MESSAGE;
        this.setPlaceholder("Select existing drawing or type name of new and hit enter.");
        break;
      case (openDialogAction.insertLinkToDrawing):
        this.emptyStateText = "No file matches your query.";
        this.setPlaceholder("Select existing drawing to insert into document.");
        break;
    }
    this.open();
  }

}