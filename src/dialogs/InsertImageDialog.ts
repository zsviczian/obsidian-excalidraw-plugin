import { App, FuzzySuggestModal, TFile } from "obsidian";
import { fileURLToPath } from "url";
import { IMAGE_TYPES, REG_LINKINDEX_INVALIDCHARS } from "../Constants";
import ExcalidrawView from "../ExcalidrawView";
import { t } from "../lang/helpers";
import ExcalidrawPlugin from "../main";

export class InsertImageDialog extends FuzzySuggestModal<TFile> {
  public app: App;
  public plugin: ExcalidrawPlugin;
  private view: ExcalidrawView;

  constructor(plugin: ExcalidrawPlugin) {
    super(plugin.app);
    this.plugin = plugin;
    this.app = plugin.app;
    this.limit = 20;
    this.setInstructions([
      {
        command: t("SELECT_FILE_WITH_OPTION_TO_SCALE"),
        purpose: "",
      },
    ]);
    this.setPlaceholder(t("SELECT_DRAWING"));
    this.emptyStateText = t("NO_MATCH");
    this.inputEl.onkeyup = (e) => {
      //@ts-ignore
      if (e.key === "Enter" && e.altKey && this.chooser.values) {
        this.onChooseItem(
          //@ts-ignore
          this.chooser.values[this.chooser.selectedItem].item,
          new KeyboardEvent("keypress",{altKey: true})
        );
        this.close();
      }
    }
  }

  getItems(): TFile[] {
    return (this.app.vault.getFiles() || []).filter(
      (f: TFile) =>
        (IMAGE_TYPES.contains(f.extension) ||
          this.plugin.isExcalidrawFile(f)) &&
        //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/422
        !f.path.match(REG_LINKINDEX_INVALIDCHARS),
    );
  }

  getItemText(item: TFile): string {
    return item.path;
  }

  onChooseItem(item: TFile, event: KeyboardEvent): void {
    const ea = this.plugin.ea;
    ea.reset();
    ea.setView(this.view);
    ea.canvas.theme = this.view.excalidrawAPI.getAppState().theme;
    (async () => {
      await ea.addImage(0, 0, item, !event.altKey);
      ea.addElementsToView(true, false, true);
    })();
  }

  public start(view: ExcalidrawView) {
    this.view = view;
    this.open();
  }
}
