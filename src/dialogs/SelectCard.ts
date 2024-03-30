import { App, FuzzySuggestModal, Notice, TFile } from "obsidian";
import { t } from "../lang/helpers";
import ExcalidrawView from "src/ExcalidrawView";
import { getEA } from "src";
import { ExcalidrawAutomate } from "src/ExcalidrawAutomate";
import { getExcalidrawMarkdownHeaderSection } from "src/ExcalidrawData";
import { MD_EX_SECTIONS } from "src/constants/constants";
import { ExcalidrawImageElement } from "@zsviczian/excalidraw/types/excalidraw/element/types";
import { ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/excalidraw/types";
import { cleanSectionHeading } from "src/utils/ObsidianUtils";

export class SelectCard extends FuzzySuggestModal<string> {

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
          if(MD_EX_SECTIONS.includes(item)) {
            new Notice(t("INVALID_SECTION_NAME"));
            this.close();
            return;
          } 
          (async () => {
            const data = view.data;
            const header = getExcalidrawMarkdownHeaderSection(data);
            view.data = data.replace(header, header + `\n# ${item}\n\n`);
            await view.forceSave(true);
            let watchdog = 0;
            await sleep(200);
            let found:string;
            while (watchdog++ < 10 && !(found=(await this.app.metadataCache.blockCache
              .getForFile({ isCancelled: () => false },view.file))
              .blocks.filter((b: any) => b.display && b.node?.type === "heading")
              .filter((b: any) => !MD_EX_SECTIONS.includes(b.display))
              .map((b: any) => cleanSectionHeading(b.display))
              .find((b: any) => b === item))) {
                await sleep(200);
            }

            const ea = getEA(this.view) as ExcalidrawAutomate;
            const id = ea.addEmbeddable(
              0,0,400,500,
              `[[${this.view.file.path}#${item}]]`
            );
            await ea.addElementsToView(true, false, true);

            const api = view.excalidrawAPI as ExcalidrawImperativeAPI;
            const el = ea.getViewElements().find(el=>el.id === id);
            api.selectElements([el]);
            setTimeout(()=>{
              api.updateScene({appState: {activeEmbeddable: {element: el, state: "active"}}});
              if(found) view.getEmbeddableLeafElementById(el.id)?.editNode?.();
            });
          })();
          //create new section
          //`# ${this.inputEl.value}\n\n`;
          //Do not allow MD_EX_SECTIONS
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
    const id = ea.addEmbeddable(
      0,0,400,500,
      `[[${this.view.file.path}#${item}]]`
    );
    (async () => {
      await ea.addElementsToView(true, false, true);
      ea.selectElementsInView([id]);
    })();
  }

  public start(): void {
    this.emptyStateText = t("EMPTY_SECTION_MESSAGE");
    this.setPlaceholder(t("SELECT_SECTION_OR_TYPE_NEW"));
    this.open();
  }
}
