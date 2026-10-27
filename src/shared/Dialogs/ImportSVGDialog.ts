import { FuzzySuggestModal, Notice, TFile } from "obsidian";
import { REG_LINKINDEX_INVALIDCHARS } from "../../constants/constants";
import ExcalidrawView from "../../view/ExcalidrawView";
import { t } from "../../lang/helpers";
import ExcalidrawPlugin from "../../core/main";
import { getEA } from "src/core";
import { errorlog } from "src/utils/coreUtils";

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
      (f: TFile) =>
        f.extension === "svg" &&
        //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/422
        !f.path.match(REG_LINKINDEX_INVALIDCHARS),
    );
  }

  getItemText(item: TFile): string {
    return item.path;
  }

  onChooseItem(item: TFile, _: KeyboardEvent): void {
    const view = this.view;
    if (!item || !view?.excalidrawAPI || !view.file) {
      return;
    }
    const api = view.excalidrawAPI, path = view.file.path, app = this.app;
    void (async () => {
      const ea = getEA(view);
      try {
        const svg = await app.vault.read(item);
        if (!svg || view.excalidrawAPI !== api || view.file?.path !== path || !ea.importSVG(svg) || !ea.getElements().length) return;
        ea.addToGroup(ea.getElements().map((el) => el.id));
        await ea.addElementsToView(true, true, true, true);
      } catch (error: unknown) {
        errorlog({where:"ImportSVGDialog.onChooseItem", error});
        new Notice(t("SVG_IMPORT_ERROR"));
      } finally {
        ea.destroy();
      }
    })();
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
