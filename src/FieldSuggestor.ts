import {
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  TFile,
} from "obsidian";
import { FRONTMATTER_KEYS_INFO } from "./constants";
import type ExcalidrawPlugin from "./main";

export class FieldSuggestor extends EditorSuggest<string> {
  plugin: ExcalidrawPlugin;

  constructor(plugin: ExcalidrawPlugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    _: TFile
  ): EditorSuggestTriggerInfo | null {
    if (this.plugin.settings.fieldSuggestor) {
      const sub = editor.getLine(cursor.line).substring(0, cursor.ch);
      const match = sub.match(/^excalidraw-(.*)$/)?.[1];
      if (match !== undefined) {
        return {
          end: cursor,
          start: {
            ch: sub.lastIndexOf(match),
            line: cursor.line,
          },
          query: match,
        };
      }
    }
    return null;
  }

  getSuggestions = (context: EditorSuggestContext) => {
    const { query } = context;
    return FRONTMATTER_KEYS_INFO.map((sug) => sug.field).filter((sug) =>
      sug.includes(query)
    );
  };

  renderSuggestion(suggestion: string, el: HTMLElement): void {
    el.createDiv({
      text: suggestion.replace("BC-", ""),
      cls: "BC-suggester-container",
      attr: {
        "aria-label": FRONTMATTER_KEYS_INFO.find((f) => f.field === suggestion)?.desc,
        "aria-label-position": "right",
      },
    });
  }

  selectSuggestion(suggestion: string): void {
    const { context } = this;
    if (context) {
      const replacement = `${suggestion}${
        FRONTMATTER_KEYS_INFO.find((f) => f.field === suggestion)?.after
      }`;
      context.editor.replaceRange(
        replacement,
        { ch: 0, line: context.start.line },
        context.end
      );
    }
  }
}