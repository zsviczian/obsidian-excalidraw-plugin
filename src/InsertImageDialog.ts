import { 
  App, 
  FuzzySuggestModal, 
  TFile 
} from "obsidian";
import { IMAGE_TYPES } from "./constants";
import { ExcalidrawAutomate } from "./ExcalidrawAutomate";
import ExcalidrawView from "./ExcalidrawView";
import {t} from './lang/helpers'

declare let window: ExcalidrawAutomate;

export class InsertImageDialog extends FuzzySuggestModal<TFile> {
  public app: App;
  private view: ExcalidrawView;
  
  constructor(app: App) {
    super(app);
    this.app = app;
    this.limit = 20;
    this.setInstructions([{
      command: t("SELECT_FILE"),
      purpose: "",
    }]);    
    this.setPlaceholder(t("SELECT_DRAWING"));
    this.emptyStateText = t("NO_MATCH");
  }

  getItems(): TFile[] {
    return (this.app.vault.getFiles() || []).filter((f:TFile) => IMAGE_TYPES.contains(f.extension));
    
  }

  getItemText(item: TFile): string {
    return item.path; 
  }

  onChooseItem(item: TFile, _evt: MouseEvent | KeyboardEvent): void {

    const ea = window.ExcalidrawAutomate;
    ea.reset();
    ea.setView(this.view);
    (async () => {
      await ea.addImage(0,0,item);
      ea.addElementsToView(true,false);
    })();
  }

  public start(view: ExcalidrawView) {
    this.view = view;
    this.open();
  }
}