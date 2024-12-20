import {
  FuzzyMatch,
  TFile,
  CachedMetadata,
  TextComponent,
  App,
  setIcon,
} from "obsidian";
import { SuggestionModal } from "./SuggestionModal";
import { t } from "src/lang/helpers";
import { LinkSuggestion } from "src/types/types";
import ExcalidrawPlugin from "src/core/main";
import { AUDIO_TYPES, CODE_TYPES, ICON_NAME, IMAGE_TYPES, VIDEO_TYPES } from "src/constants/constants";

export class FileSuggestionModal extends SuggestionModal<LinkSuggestion> {
  text: TextComponent;
  cache: CachedMetadata;
  filesAndAliases: LinkSuggestion[];
  file: TFile;
  constructor(app: App, input: TextComponent, items: TFile[], private plugin: ExcalidrawPlugin) {
    const filesAndAliases = [];
    for (const file of items) {
      const path = file.path;
      filesAndAliases.push({ file, path, alias: "" });
      const metadata = app.metadataCache.getFileCache(file); // Get metadata for the file
      const aliases = metadata?.frontmatter?.aliases || []; // Check for frontmatter aliases

      for (const alias of aliases) {
        if(!alias) continue; // Skip empty aliases
        filesAndAliases.push({ file, path, alias });
      }
    }
    super(app, input.inputEl, filesAndAliases);
    this.limit = 20;
    this.filesAndAliases = filesAndAliases;
    this.text = input;
    this.suggestEl.style.maxWidth = "100%";
    this.suggestEl.style.width = `${input.inputEl.clientWidth}px`;
    this.inputEl.addEventListener("input", () => this.getFile());
    this.setPlaceholder(t("SELECT_FILE_TO_INSERT"));
    this.emptyStateText = t("NO_MATCH");
  }

  getFile() {
    const v = this.inputEl.value;
    const file = this.app.vault.getAbstractFileByPath(v);
    if (file === this.file) {
      return;
    }
    if (!(file instanceof TFile)) {
      return;
    }
    this.file = file;

    this.onInputChanged();
  }

  getSelectedItem() {
    return this.file;
  }

  getItemText(item: LinkSuggestion) {
    return `${item.file.path}${item.alias ? `|${item.alias}` : ""}`;
  }

  onChooseItem(item: LinkSuggestion) {
    this.file = item.file;
    this.text.setValue(this.getItemText(item));
    this.text.onChanged();
  }

  selectSuggestion({ item }: FuzzyMatch<LinkSuggestion>) {
    this.file = item.file;
    this.text.setValue(this.getItemText(item));
    this.onClose();
    this.text.onChanged();
    this.close();
  }
  
  renderSuggestion(result: FuzzyMatch<LinkSuggestion>, itemEl: HTMLElement) {
    const { item, match: matches } = result || {};
    itemEl.addClass("mod-complex");
    const contentEl = itemEl.createDiv("suggestion-content");
    const auxEl = itemEl.createDiv("suggestion-aux");
    const titleEl = contentEl.createDiv("suggestion-title");
    const noteEl = contentEl.createDiv("suggestion-note");

    //el.style.flexDirection = "column";
    //content.style.flexDirection = "initial";

    if (!item) {
      titleEl.setText(this.emptyStateText);
      itemEl.addClass("is-selected");
      return;
    }

    const path = item.file?.path ?? item.path;
    const pathLength = path.length - item.file.name.length;
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

    if(this.plugin.isExcalidrawFile(item.file)) {
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

  getItems() {
    return this.filesAndAliases;
  }
}