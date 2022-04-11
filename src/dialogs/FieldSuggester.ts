import {
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  TFile,
} from "obsidian";
import { FRONTMATTER_KEYS_INFO } from "./SuggesterInfo";
import {
  EXCALIDRAW_AUTOMATE_INFO,
  EXCALIDRAW_SCRIPTENGINE_INFO,
} from "./SuggesterInfo";
import type ExcalidrawPlugin from "../main";

export class FieldSuggester extends EditorSuggest<string> {
  plugin: ExcalidrawPlugin;
  suggestType: "ea" | "excalidraw" | "utils";
  latestTriggerInfo: EditorSuggestTriggerInfo;

  constructor(plugin: ExcalidrawPlugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    _: TFile,
  ): EditorSuggestTriggerInfo | null {
    if (this.plugin.settings.fieldSuggester) {
      const sub = editor.getLine(cursor.line).substring(0, cursor.ch);
      const match =
        sub.match(/^excalidraw-(.*)$/)?.[1] ??
        sub.match(/(^ea|\Wea)\.([\w\.]*)$/)?.[2] ??
        sub.match(/(^utils|\Wutils)\.([\w\.]*)$/)?.[2];
      if (match !== undefined) {
        this.suggestType = sub.match(/^excalidraw-(.*)$/)
          ? "excalidraw"
          : sub.match(/(^ea|\Wea)\.([\w\.]*)$/)
          ? "ea"
          : "utils";
        this.latestTriggerInfo = {
          end: cursor,
          start: {
            ch: cursor.ch - match.length,
            line: cursor.line,
          },
          query: match,
        };
        return this.latestTriggerInfo;
      }
    }
    return null;
  }

  getSuggestions = (context: EditorSuggestContext) => {
    const query = context.query.toLowerCase();
    const keys =
      this.suggestType === "ea"
        ? EXCALIDRAW_AUTOMATE_INFO
        : this.suggestType === "utils"
        ? EXCALIDRAW_SCRIPTENGINE_INFO
        : FRONTMATTER_KEYS_INFO;
    return keys
      .map((sug) => sug.field)
      .filter((sug) => sug.toLowerCase().includes(query));
  };

  renderSuggestion(suggestion: string, el: HTMLElement): void {
    const text = suggestion.replace(
      this.suggestType === "ea"
        ? "ea."
        : this.suggestType === "utils"
        ? "utils."
        : "excalidraw-",
      "",
    );
    const keys =
      this.suggestType === "ea"
        ? EXCALIDRAW_AUTOMATE_INFO
        : this.suggestType === "utils"
        ? EXCALIDRAW_SCRIPTENGINE_INFO
        : FRONTMATTER_KEYS_INFO;
    const value = keys.find((f) => f.field === suggestion);
    el.createEl("b", { text });
    el.createEl("br");
    if (value.code) {
      el.createEl("code", { text: value.code });
    }
    if (value.desc) {
      el.createDiv("div", (el) => (el.innerHTML = value.desc));
    }
  }

  selectSuggestion(suggestion: string): void {
    const { context } = this;
    if (context) {
      const keys =
        this.suggestType === "ea"
          ? EXCALIDRAW_AUTOMATE_INFO
          : this.suggestType === "utils"
          ? EXCALIDRAW_SCRIPTENGINE_INFO
          : FRONTMATTER_KEYS_INFO;
      const replacement = `${suggestion}${
        keys.find((f) => f.field === suggestion)?.after
      }`;
      context.editor.replaceRange(
        replacement,
        this.latestTriggerInfo.start,
        this.latestTriggerInfo.end,
      );
      if (this.latestTriggerInfo.start.ch === this.latestTriggerInfo.end.ch) {
        // Dirty hack to prevent the cursor being at the
        // beginning of the word after completion,
        // Not sure what's the cause of this bug.
        const cursor_pos = this.latestTriggerInfo.end;
        cursor_pos.ch += replacement.length;
        context.editor.setCursor(cursor_pos);
      }
    }
  }
}
