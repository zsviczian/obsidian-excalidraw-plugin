import { FuzzyMatch, FuzzySuggestModal } from "obsidian";
import { t } from "../../lang/helpers";
import ExcalidrawPlugin from "src/core/main";
import { getLink } from "src/utils/fileUtils";
import { LinkSuggestion } from "src/types/types";
import { getLinkSuggestionsFiltered, getSortedLinkMatches, renderLinkSuggestion } from "src/shared/Suggesters/LinkSuggesterUtils";


export class InsertLinkDialog extends FuzzySuggestModal<LinkSuggestion> {
  private addText: Function;
  private drawingPath: string;

  destroy() {
    this.app = null;
    this.addText = null;
    this.drawingPath = null;
  }

  constructor(private plugin: ExcalidrawPlugin) {
    super(plugin.app);
    this.app = plugin.app;
    this.limit = 20;
    this.setInstructions([
      {
        command: t("SELECT_FILE"),
        purpose: "",
      },
    ]);
    this.setPlaceholder(t("SELECT_FILE_TO_LINK"));
    this.emptyStateText = t("NO_MATCH");
  }

  getItems(): LinkSuggestion[] {
    //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/422
    return getLinkSuggestionsFiltered(this.app);
  }

  getItemText(item: LinkSuggestion): string {
    return item.path + (item.alias ? `|${item.alias}` : "");
  }

  onChooseItem(item: LinkSuggestion): void {
    let filepath = item.path;
    if (item.file) {
      filepath = this.app.metadataCache.fileToLinktext(
        item.file,
        this.drawingPath,
        true,
      );
    }
    const link = getLink(this.plugin,{embed: false, path: filepath, alias: item.alias});
    this.addText(getLink(this.plugin,{embed: false, path: filepath, alias: item.alias}), filepath, item.alias);
  }

  renderSuggestion(result: FuzzyMatch<LinkSuggestion>, itemEl: HTMLElement) {
    renderLinkSuggestion(this.plugin, result, itemEl, this.emptyStateText);
  }

  getSuggestions(query: string): FuzzyMatch<LinkSuggestion>[] {
    return getSortedLinkMatches(query, this.getItems());
  }

  onClose(): void {
    window.setTimeout(()=>{
      this.addText = null
    }); //make sure this happens after onChooseItem runs
    super.onClose();
  }

  private inLink: string;
  onOpen(): void {
    super.onOpen();
    if(this.inLink) {
      this.inputEl.value = this.inLink;
      this.inputEl.dispatchEvent(new Event('input'));
    }
  }

  public start(drawingPath: string, addText: Function, link?: string) {
    this.addText = addText;
    this.drawingPath = drawingPath;
    this.inLink = link;
    this.open();
  }
}
