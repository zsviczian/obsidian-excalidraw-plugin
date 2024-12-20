import { FuzzyMatch, FuzzySuggestModal, setIcon } from "obsidian";
import { AUDIO_TYPES, CODE_TYPES, ICON_NAME, IMAGE_TYPES, REG_LINKINDEX_INVALIDCHARS, VIDEO_TYPES } from "../../constants/constants";
import { t } from "../../lang/helpers";
import ExcalidrawPlugin from "src/core/main";
import { getLink } from "src/utils/fileUtils";
import { LinkSuggestion } from "src/types/types";


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
    return (
      this.app.metadataCache
        //@ts-ignore
        .getLinkSuggestions()
        //@ts-ignore
        .filter((x) => !x.path.match(REG_LINKINDEX_INVALIDCHARS))
    );
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
    const { item, match: matches } = result || {};
    itemEl.addClass("mod-complex");
    const contentEl = itemEl.createDiv("suggestion-content");
    const auxEl = itemEl.createDiv("suggestion-aux");
    const titleEl = contentEl.createDiv("suggestion-title");
    const noteEl = contentEl.createDiv("suggestion-note");

    if (!item) {
      titleEl.setText(this.emptyStateText);
      itemEl.addClass("is-selected");
      return;
    }

    const path = item.file?.path ?? item.path;

    const pathLength = path.length - (item.file?.name.length ?? 0);
    const matchElements = matches.matches.map((m) => {
      return createSpan("suggestion-highlight");
    });
    const itemText = this.getItemText(item);
    for (let i = pathLength; i < itemText.length; i++) {
      const match = matches.matches.find((m) => m[0] === i);
      if (match) {
        const element = matchElements[matches.matches.indexOf(match)];
        titleEl.appendChild(element);
        element.appendText(itemText.substring(match[0], match[1]));

        i += match[1] - match[0] - 1;
        continue;
      }

      titleEl.appendText(itemText[i]);
    }
    noteEl.setText(path);

    if(!item.file) {
      setIcon(auxEl, "ghost");
    } else if(this.plugin.isExcalidrawFile(item.file)) {
      setIcon(auxEl, ICON_NAME);
    } else if (item.file.extension === "md") {
      setIcon(auxEl, "square-pen");
    } else if (IMAGE_TYPES.includes(item.file.extension)) {
      setIcon(auxEl, "image");
    } else if (VIDEO_TYPES.includes(item.file.extension)) {
      setIcon(auxEl, "monitor-play");
    } else if (AUDIO_TYPES.includes(item.file.extension)) {
      setIcon(auxEl, "file-audio");
    } else if (CODE_TYPES.includes(item.file.extension)) {
      setIcon(auxEl, "file-code");
    } else if (item.file.extension === "canvas") {
      setIcon(auxEl, "layout-dashboard");
    } else if (item.file.extension === "pdf") {
      setIcon(auxEl, "book-open-text");
    } else {
      auxEl.setText(item.file.extension);
    }
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
