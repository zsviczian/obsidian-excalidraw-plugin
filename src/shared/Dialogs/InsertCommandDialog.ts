import { App, FuzzySuggestModal, TFile } from "obsidian";
import { REG_LINKINDEX_INVALIDCHARS } from "../../constants/constants";
import { t } from "../../lang/helpers";

export class InsertCommandDialog extends FuzzySuggestModal<TFile> {
  private addText: Function;

  destroy() {
    this.app = null;
    this.addText = null;
  }

  constructor(app: App) {
    super(app);
    this.app = app;
    this.limit = 20;
    this.setInstructions([
      {
        command: t("SELECT_COMMAND"),
        purpose: "",
      },
    ]);
    this.setPlaceholder(t("SELECT_COMMAND_PLACEHOLDER"));
    this.emptyStateText = t("NO_MATCHING_COMMAND");
  }

  getItems(): any[] {
    //@ts-ignore
    return this.app.commands.listCommands();
  }

  getItemText(item: any): string {
    return item.name;
  }

  onChooseItem(item: any): void {
    const cmdId = item?.id;
    this.addText(`⚙️[${item.name}](cmd://${item.id})`);
    this.addText = null;
  }

  public start(addText: Function) {
    this.addText = addText;
    this.open();
  }

  onClose(): void {
    window.setTimeout(()=>{
      this.addText = null;
    }) //onChooseItem must run first
    super.onClose();
  }
}
