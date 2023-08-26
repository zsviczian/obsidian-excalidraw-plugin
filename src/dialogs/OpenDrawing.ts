import { App, FuzzySuggestModal, TFile } from "obsidian";
import ExcalidrawPlugin from "../main";
import { EMPTY_MESSAGE } from "../constants";
import { t } from "../lang/helpers";

export enum openDialogAction {
  openFile,
  insertLinkToDrawing,
}

export class OpenFileDialog extends FuzzySuggestModal<TFile> {
  public app: App;
  private plugin: ExcalidrawPlugin;
  private action: openDialogAction;
  private onNewPane: boolean;

  constructor(app: App, plugin: ExcalidrawPlugin) {
    super(app);
    this.app = app;
    this.action = openDialogAction.openFile;
    this.plugin = plugin;
    this.onNewPane = false;
    this.limit = 20;
    this.setInstructions([
      {
        command: t("TYPE_FILENAME"),
        purpose: "",
      },
    ]);

    this.inputEl.onkeyup = (e) => {
      if (e.key == "Enter" && this.action == openDialogAction.openFile) {
        if (this.containerEl.innerText.includes(EMPTY_MESSAGE)) {
          this.plugin.createAndOpenDrawing(
            `${this.plugin.settings.folder}/${this.inputEl.value}.excalidraw.md`,
            this.onNewPane?"new-pane":"active-pane",
          );
          this.close();
        }
      }
    };
  }

  getItems(): TFile[] {
    const excalidrawFiles = this.app.vault.getFiles();
    return (excalidrawFiles || []).filter((f: TFile) =>
      this.plugin.isExcalidrawFile(f),
    );
  }

  getItemText(item: TFile): string {
    return item.path;
  }

  onChooseItem(item: TFile): void {
    switch (this.action) {
      case openDialogAction.openFile:
        this.plugin.openDrawing(item, this.onNewPane?"new-pane":"active-pane",true);
        break;
      case openDialogAction.insertLinkToDrawing:
        this.plugin.embedDrawing(item);
        break;
    }
  }

  public start(action: openDialogAction, onNewPane: boolean): void {
    this.action = action;
    this.onNewPane = onNewPane;
    switch (action) {
      case openDialogAction.openFile:
        this.emptyStateText = EMPTY_MESSAGE;
        this.setPlaceholder(t("SELECT_FILE_OR_TYPE_NEW"));
        break;
      case openDialogAction.insertLinkToDrawing:
        this.emptyStateText = t("NO_MATCH");
        this.setPlaceholder(t("SELECT_TO_EMBED"));
        break;
    }
    this.open();
  }
}
