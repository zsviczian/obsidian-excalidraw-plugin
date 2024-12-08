import {
  FuzzyMatch,
  CachedMetadata,
  TextComponent,
  App,
  TFolder,
} from "obsidian";
import { SuggestionModal } from "./SuggestionModal";

export class FolderSuggestionModal extends SuggestionModal<TFolder> {
  text: TextComponent;
  cache: CachedMetadata;
  folders: TFolder[];
  folder: TFolder;
  constructor(app: App, input: TextComponent, items: TFolder[]) {
    super(app, input.inputEl, items);
    this.folders = [...items];
    this.text = input;

    this.inputEl.addEventListener("input", () => this.getFolder());
  }
  getFolder() {
    const v = this.inputEl.value;
    const folder = this.app.vault.getAbstractFileByPath(v);
    if (folder == this.folder) {
      return;
    }
    if (!(folder instanceof TFolder)) {
      return;
    }
    this.folder = folder;

    this.onInputChanged();
  }
  getItemText(item: TFolder) {
    return item.path;
  }
  onChooseItem(item: TFolder) {
    this.text.setValue(item.path);
    this.folder = item;
  }
  selectSuggestion({ item }: FuzzyMatch<TFolder>) {
    const link = item.path;

    this.text.setValue(link);
    this.onClose();

    this.close();
  }
  renderSuggestion(result: FuzzyMatch<TFolder>, el: HTMLElement) {
    const { item, match: matches } = result || {};
    const content = el.createDiv({
      cls: "suggestion-content",
    });
    if (!item) {
      content.setText(this.emptyStateText);
      content.parentElement.addClass("is-selected");
      return;
    }

    const pathLength = item.path.length - item.name.length;
    const matchElements = matches.matches.map((m) => {
      return createSpan("suggestion-highlight");
    });
    for (let i = pathLength; i < item.path.length; i++) {
      const match = matches.matches.find((m) => m[0] === i);
      if (match) {
        const element = matchElements[matches.matches.indexOf(match)];
        content.appendChild(element);
        element.appendText(item.path.substring(match[0], match[1]));

        i += match[1] - match[0] - 1;
        continue;
      }

      content.appendText(item.path[i]);
    }
    el.createDiv({
      cls: "suggestion-note",
      text: item.path,
    });
  }

  getItems() {
    return this.folders;
  }
}