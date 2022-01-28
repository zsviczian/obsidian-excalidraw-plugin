import {
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  TFile,
} from "obsidian";
import { FRONTMATTER_KEYS_INFO } from "./constants";
import { EXCALIDRAW_AUTOMATE_INFO } from "./ExcalidrawAutomateFieldSuggestor";
import type ExcalidrawPlugin from "./main";

export class FieldSuggestor extends EditorSuggest<string> {
  plugin: ExcalidrawPlugin;
  suggestEA: boolean;
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
    if (this.plugin.settings.fieldSuggestor) {
      const sub = editor.getLine(cursor.line).substring(0, cursor.ch);
      const match =
        sub.match(/^excalidraw-(.*)$/)?.[1] ?? sub.match(/ea\.([\w\.]*)$/)?.[1];
      if (match !== undefined) {
        this.suggestEA = !sub.match(/^excalidraw-(.*)$/);
        this.latestTriggerInfo = {
          end: cursor,
          start: {
            ch: cursor.ch-match.length,
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
    const { query } = context;
    const isEA = this.suggestEA;
    const keys = isEA ? EXCALIDRAW_AUTOMATE_INFO : FRONTMATTER_KEYS_INFO;
    return keys.map((sug) => sug.field).filter((sug) =>
      sug.includes(query),
    );
  };

  renderSuggestion(suggestion: string, el: HTMLElement): void {
    const isEA = this.suggestEA;
    const text = suggestion.replace(isEA ? "ea." : "excalidraw-", "");
    const keys = isEA ? EXCALIDRAW_AUTOMATE_INFO : FRONTMATTER_KEYS_INFO;
    el.createDiv({
      text,
      cls: "excalidraw-suggester-container",
      attr: {
        "aria-label": keys.find((f) => f.field === suggestion)?.desc,
        "aria-label-position": "right",
        "aria-label-classes": "excalidraw-suggester-label"
      },
    });
  }

  selectSuggestion(suggestion: string): void {
    const { context } = this;
    if (context) {
      const isEA = this.suggestEA;
      const keys = isEA ? EXCALIDRAW_AUTOMATE_INFO : FRONTMATTER_KEYS_INFO;
      const replacement = `${suggestion}${
        keys.find((f) => f.field === suggestion)?.after
      }`;
      context.editor.replaceRange(
        replacement,
        this.latestTriggerInfo.start,
        this.latestTriggerInfo.end
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
