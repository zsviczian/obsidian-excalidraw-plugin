import { App, FuzzySuggestModal, TFile } from "obsidian";
import { isALT, scaleToFullsizeModifier } from "src/utils/ModifierkeyHelper";
import { fileURLToPath } from "url";
import { DEVICE, IMAGE_TYPES, REG_LINKINDEX_INVALIDCHARS } from "../constants";
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
      if (e.key === "Enter" && scaleToFullsizeModifier(e) && this.chooser.values) {
        this.onChooseItem(
          //@ts-ignore
          this.chooser.values[this.chooser.selectedItem].item,
          new KeyboardEvent("keypress",{
            shiftKey: true,
            metaKey: !(DEVICE.isIOS || DEVICE.isMacOS),
            ctrlKey: (DEVICE.isIOS || DEVICE.isMacOS),
          })
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
    const ea = this.plugin.ea.getAPI(this.view);
    ea.canvas.theme = this.view.excalidrawAPI.getAppState().theme;
    const scaleToFullsize = scaleToFullsizeModifier(event);
    (async () => {
      await ea.addImage(0, 0, item, !scaleToFullsize);
      ea.addElementsToView(true, true, true);
    })();
  }

  public start(view: ExcalidrawView) {
    this.view = view;
    this.open();
  }
}
