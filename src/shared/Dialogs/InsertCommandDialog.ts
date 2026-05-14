import { App, FuzzySuggestModal } from "obsidian";
import { t } from "../../lang/helpers";
import type { ObsidianCommand } from "src/types/types";

export class InsertCommandDialog extends FuzzySuggestModal<ObsidianCommand> {
  private addText: ((value: string) => void) | null = null;

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

  getItems(): ObsidianCommand[] {
    return this.app.commands.listCommands();
  }

  getItemText(item: ObsidianCommand): string {
    return item.name;
  }

  onChooseItem(item: ObsidianCommand): void {
    this.addText?.(`⚙️[${item.name}](cmd://${item.id})`);
    this.addText = null;
  }

  public start(addText: (value: string) => void) {
    this.addText = addText;
    this.open();
  }

  onClose(): void {
    window.setTimeout(() => {
      this.addText = null;
    }); //onChooseItem must run first
    super.onClose();
  }
}
