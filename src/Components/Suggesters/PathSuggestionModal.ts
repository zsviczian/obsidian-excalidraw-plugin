import {
  FuzzyMatch,
  TFile,
  BlockCache,
  HeadingCache,
  CachedMetadata,
  TextComponent,
  App,
} from "obsidian";
import { SuggestionModal } from "./SuggestionModal";

export class PathSuggestionModal extends SuggestionModal<
  TFile | BlockCache | HeadingCache
> {
  file: TFile;
  files: TFile[];
  text: TextComponent;
  cache: CachedMetadata;
  constructor(app: App, input: TextComponent, items: TFile[]) {
    super(app, input.inputEl, items);
    this.files = [...items];
    this.text = input;
    //this.getFile();

    this.inputEl.addEventListener("input", this.getFile.bind(this));
  }

  getFile() {
    const v = this.inputEl.value;
    const file = this.app.metadataCache.getFirstLinkpathDest(
      v.split(/[\^#]/).shift() || "",
      "",
    );
    if (file == this.file) {
      return;
    }
    this.file = file;
    if (this.file) {
      this.cache = this.app.metadataCache.getFileCache(this.file);
    }
    this.onInputChanged();
  }
  getItemText(item: TFile | HeadingCache | BlockCache) {
    if (item instanceof TFile) {
      return item.path;
    }
    if (Object.prototype.hasOwnProperty.call(item, "heading")) {
      return (<HeadingCache>item).heading;
    }
    if (Object.prototype.hasOwnProperty.call(item, "id")) {
      return (<BlockCache>item).id;
    }
  }
  onChooseItem(item: TFile | HeadingCache | BlockCache) {
    if (item instanceof TFile) {
      this.text.setValue(item.basename);
      this.file = item;
      this.cache = this.app.metadataCache.getFileCache(this.file);
    } else if (Object.prototype.hasOwnProperty.call(item, "heading")) {
      this.text.setValue(
        `${this.file.basename}#${(<HeadingCache>item).heading}`,
      );
    } else if (Object.prototype.hasOwnProperty.call(item, "id")) {
      this.text.setValue(`${this.file.basename}^${(<BlockCache>item).id}`);
    }
  }
  selectSuggestion({ item }: FuzzyMatch<TFile | BlockCache | HeadingCache>) {
    let link: string;
    if (item instanceof TFile) {
      link = item.basename;
    } else if (Object.prototype.hasOwnProperty.call(item, "heading")) {
      link = `${this.file.basename}#${(<HeadingCache>item).heading}`;
    } else if (Object.prototype.hasOwnProperty.call(item, "id")) {
      link = `${this.file.basename}^${(<BlockCache>item).id}`;
    }

    this.text.setValue(link);
    this.onClose();

    this.close();
  }
  renderSuggestion(
    result: FuzzyMatch<TFile | BlockCache | HeadingCache>,
    el: HTMLElement,
  ) {
    const { item, match: matches } = result || {};
    const content = el.createDiv({
      cls: "suggestion-content",
    });
    if (!item) {
      content.setText(this.emptyStateText);
      content.parentElement.addClass("is-selected");
      return;
    }

    if (item instanceof TFile) {
      const pathLength = item.path.length - item.name.length;
      const matchElements = matches.matches.map((m) => {
        return createSpan("suggestion-highlight");
      });
      for (
        let i = pathLength;
        i < item.path.length - item.extension.length - 1;
        i++
      ) {
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
    } else if (Object.prototype.hasOwnProperty.call(item, "heading")) {
      content.setText((<HeadingCache>item).heading);
      content.prepend(
        createSpan({
          cls: "suggestion-flair",
          text: `H${(<HeadingCache>item).level}`,
        }),
      );
    } else if (Object.prototype.hasOwnProperty.call(item, "id")) {
      content.setText((<BlockCache>item).id);
    }
  }
  get headings() {
    if (!this.file) {
      return [];
    }
    if (!this.cache) {
      this.cache = this.app.metadataCache.getFileCache(this.file);
    }
    return this.cache.headings || [];
  }
  get blocks() {
    if (!this.file) {
      return [];
    }
    if (!this.cache) {
      this.cache = this.app.metadataCache.getFileCache(this.file);
    }
    return Object.values(this.cache.blocks || {}) || [];
  }
  getItems() {
    const v = this.inputEl.value;
    if (/#/.test(v)) {
      this.modifyInput = (i) => i.split(/#/).pop();
      return this.headings;
    } else if (/\^/.test(v)) {
      this.modifyInput = (i) => i.split(/\^/).pop();
      return this.blocks;
    }
    return this.files;
  }
}
