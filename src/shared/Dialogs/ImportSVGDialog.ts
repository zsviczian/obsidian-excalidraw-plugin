import { App, FuzzySuggestModal, TFile } from "obsidian";
import { REG_LINKINDEX_INVALIDCHARS } from "../../constants/constants";
import ExcalidrawView from "../../view/ExcalidrawView";
import { t } from "../../lang/helpers";
import ExcalidrawPlugin from "../../core/main";
import { getEA } from "src/core";
import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";

export class ImportSVGDialog extends FuzzySuggestModal<TFile> {
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
    this.setPlaceholder(t("SELECT_DRAWING"));
    this.emptyStateText = t("NO_MATCH");
  }

  getItems(): TFile[] {
    return (this.app.vault.getFiles() || []).filter(
      (f: TFile) => f.extension === "svg" &&
        //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/422
        !f.path.match(REG_LINKINDEX_INVALIDCHARS),
    );
  }

  getItemText(item: TFile): string {
    return item.path;
  }

  async onChooseItem(item: TFile, _: KeyboardEvent): Promise<void> {
    if(!item) return;
    const ea = getEA(this.view) as ExcalidrawAutomate;
    const svg = await this.app.vault.read(item);
    if(!svg || svg === "") return;
    ea.importSVG(svg);
    ea.addToGroup(ea.getElements().map(el=>el.id));
    await ea.addElementsToView(true, true, true,true);
    ea.destroy();
  }

  onClose(): void {
    //deley this.view destruction until onChooseItem is called
    window.setTimeout(() => {
      this.view = null;
    });
    super.onClose();
  }

  public start(view: ExcalidrawView) {
    this.view = view;
    this.open();
  }
}
