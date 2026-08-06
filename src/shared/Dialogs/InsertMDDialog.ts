import { FuzzySuggestModal, TFile } from "obsidian";
import ExcalidrawView from "../../view/ExcalidrawView";
import { t } from "../../lang/helpers";
import ExcalidrawPlugin from "../../core/main";
import { UniversalInsertFileModal } from "./UniversalInsertFileModal";

export class InsertMDDialog extends FuzzySuggestModal<TFile> {
  public plugin: ExcalidrawPlugin;
  private view: ExcalidrawView;

  destroy() {
    this.app = null;
    this.plugin = null;
    this.view = null;
  }

  constructor(plugin: ExcalidrawPlugin) {
    super(plugin.app);
    this.plugin = plugin;
    this.app = plugin.app;
    this.limit = 20;
    this.setInstructions([
      {
        command: t("SELECT_FILE"),
        purpose: "",
      },
    ]);
    this.setPlaceholder(t("SELECT_MD"));
    this.emptyStateText = t("NO_MATCH");
  }

  getItems(): TFile[] {
    return (this.app.vault.getFiles() || []).filter(
      (f: TFile) => f.extension === "md" && !this.plugin.isExcalidrawFile(f),
    );
  }

  getItemText(item: TFile): string {
    return item.path;
  }

  onChooseItem(item: TFile): void {
    new UniversalInsertFileModal(this.plugin, this.view).open(
      item,
      this.view.currentPosition,
      "image",
    );
  }

  public start(view: ExcalidrawView) {
    this.view = view;
    this.open();
  }

  onClose(): void {
    //deley this.view destruction until onChooseItem is called
    window.setTimeout(() => {
      this.view = null;
    });
    super.onClose();
  }
}
