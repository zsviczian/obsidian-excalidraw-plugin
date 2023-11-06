import { App, FuzzySuggestModal, TFile } from "obsidian";
import { REG_LINKINDEX_INVALIDCHARS } from "../constants";
import { t } from "../lang/helpers";

export class InsertLinkDialog extends FuzzySuggestModal<TFile> {
  public app: App;
  private addText: Function;
  private drawingPath: string;

  constructor(app: App) {
    super(app);
    this.app = app;
    this.limit = 20;
    this.setInstructions([
      {
        command: t("SELECT_FILE"),
        purpose: "",
      },
    ]);
    this.setPlaceholder(t("SELECT_FILE_TO_LINK"));
    this.emptyStateText = t("NO_MATCH");
  }

  getItems(): any[] {
    //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/422
    return (
      this.app.metadataCache
        //@ts-ignore
        .getLinkSuggestions()
        //@ts-ignore
        .filter((x) => !x.path.match(REG_LINKINDEX_INVALIDCHARS))
    );
  }

  getItemText(item: any): string {
    return item.path + (item.alias ? `|${item.alias}` : "");
  }

  onChooseItem(item: any): void {
    let filepath = item.path;
    if (item.file) {
      filepath = this.app.metadataCache.fileToLinktext(
        item.file,
        this.drawingPath,
        true,
      );
    }
    this.addText(`[[${filepath + (item.alias ? `|${item.alias}` : "")}]]`, filepath, item.alias);
  }

  public start(drawingPath: string, addText: Function) {
    this.addText = addText;
    this.drawingPath = drawingPath;
    this.open();
  }
}
