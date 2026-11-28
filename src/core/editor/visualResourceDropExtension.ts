import { Prec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { editorInfoField, MarkdownView } from "obsidian";
import type ExcalidrawPlugin from "../main";

/** Accept the resource browser's own drag in the Markdown editor under the pointer. */
export function visualResourceDropExtension(plugin: ExcalidrawPlugin) {
  const accepting = (event: DragEvent, editor: EditorView) => {
    const info = editor.state.field(editorInfoField, false);
    const service = plugin.visualResources;
    if (event.defaultPrevented || editor.state.readOnly || !(info instanceof MarkdownView) ||
        info.getMode() !== "source" || !info.file || !event.dataTransfer ||
        !service?.canDropInMarkdown(event.dataTransfer, info.file)) return null;
    return { file: info.file, transfer: event.dataTransfer, service };
  };
  return Prec.high(EditorView.domEventHandlers({
    dragover(event, editor) {
      if (!accepting(event, editor)) return false;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      return true;
    },
    drop(event, editor) {
      const target = accepting(event, editor);
      if (!target) return false;
      const position = editor.posAtCoords({ x: event.clientX, y: event.clientY }, false);
      if (position === null) return false;
      const link = target.service.markdownDrop(target.transfer, target.file);
      if (!link) return false;
      event.preventDefault();
      editor.dispatch({ changes: { from: position, insert: link }, selection: { anchor: position + link.length }, userEvent: "input.drop" });
      editor.focus();
      return true;
    },
  }));
}
