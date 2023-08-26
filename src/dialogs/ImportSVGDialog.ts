import { App, FuzzySuggestModal, TFile } from "obsidian";
import { REG_LINKINDEX_INVALIDCHARS } from "../constants";
import ExcalidrawView from "../ExcalidrawView";
import { t } from "../lang/helpers";
import ExcalidrawPlugin from "../main";

export class ImportSVGDialog extends FuzzySuggestModal<TFile> {
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

  async onChooseItem(item: TFile, event: KeyboardEvent): Promise<void> {
    if(!item) return;
    const ea = this.plugin.ea;
    ea.reset();
    ea.setView(this.view);
    const svg = await app.vault.read(item);
    if(!svg || svg === "") return;
    ea.importSVG(svg);
    ea.addElementsToView(true, true, true,true);
  }

  public start(view: ExcalidrawView) {
    this.view = view;
    this.open();
  }
}
