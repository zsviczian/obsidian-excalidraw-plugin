import { FuzzySuggestModal, TFile } from "obsidian";
import { scaleToFullsizeModifier } from "src/utils/modifierkeyHelper";
import { DEVICE, IMAGE_TYPES, REG_LINKINDEX_INVALIDCHARS } from "../../constants/constants";
import ExcalidrawView from "../../view/ExcalidrawView";
import { t } from "../../lang/helpers";
import ExcalidrawPlugin from "../../core/main";
import { getEA } from "src/core";

export class InsertImageDialog extends FuzzySuggestModal<TFile> {
  public plugin: ExcalidrawPlugin;
  private view: ExcalidrawView;

  destroy() {
    this.app = null;
    this.plugin = null;
    this.view = null;
    this.inputEl.onkeyup = null;
  }

  onClose(): void {
    //deley this.view destruction until onChooseItem is called
    window.setTimeout(() => {
      this.view = null;
    });
    super.onClose();
  }

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
    const ea = getEA(this.view);
    ea.canvas.theme = this.view.excalidrawAPI.getAppState().theme;
    const scaleToFullsize = scaleToFullsizeModifier(event);
    (async () => {
      //this.view.currentPosition = this.position;
      await ea.addImage(0, 0, item, !scaleToFullsize);
      await ea.addElementsToView(true, true, true);
      ea.destroy();
    })();
  }

  public start(view: ExcalidrawView) {
    this.view = view;
    this.open();
  }
}
