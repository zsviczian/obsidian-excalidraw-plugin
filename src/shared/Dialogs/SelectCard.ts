import { App, FuzzySuggestModal, Notice } from "obsidian";
import { t } from "../../lang/helpers";
import ExcalidrawView from "src/view/ExcalidrawView";
import { getEA } from "src/core";
import { ExcalidrawAutomate } from "src/shared/ExcalidrawAutomate";
import { CARD_HEIGHT, CARD_WIDTH, MD_EX_SECTIONS } from "src/constants/constants";
import { addBackOfTheNoteCard } from "src/utils/excalidrawViewUtils";

export class SelectCard extends FuzzySuggestModal<string> {
  private center: boolean = false;

  constructor(
    public app: App,
    private view: ExcalidrawView,
    private sections: string[]
  ) {
    super(app);
    this.limit = 20;
    this.setInstructions([
      {
        command: t("TYPE_SECTION"),
        purpose: "",
      },
    ]);

    this.inputEl.onkeyup = (e) => {
      if (e.key == "Enter") {
        if (this.containerEl.innerText.includes(t("EMPTY_SECTION_MESSAGE"))) {
          const item = this.inputEl.value;
          if(item === "" || MD_EX_SECTIONS.includes(item)) {
            new Notice(t("INVALID_SECTION_NAME"));
            this.close();
            return;
          }
          addBackOfTheNoteCard(this.view, item, true, undefined, undefined, this.center);
          this.close();
        }
      }
    };
  }

  getItems(): string[] {
    return this.sections;
  }

  getItemText(item: string): string {
    return item;
  }

  onChooseItem(item: string): void {
    const ea = getEA(this.view) as ExcalidrawAutomate;
    let x,y = 0;
    if(this.center) {
      const centerPos = ea.getViewCenterPosition();
      if(centerPos) {
        x = centerPos.x - (CARD_WIDTH / 2);
        y = centerPos.y - (CARD_HEIGHT / 2);
      }
    }

    const id = ea.addEmbeddable(
      x,y,CARD_WIDTH,CARD_HEIGHT,
      `[[${this.view.file.path}#${item}]]`
    );
    (async () => {
      await ea.addElementsToView(!this.center, false, true);
      ea.selectElementsInView([id]);
      ea.destroy();
    })();
  }

  public start(center: boolean = false): void {
    this.center = center;
    this.emptyStateText = t("EMPTY_SECTION_MESSAGE");
    this.setPlaceholder(t("SELECT_SECTION_OR_TYPE_NEW"));
    this.open();
  }
}
