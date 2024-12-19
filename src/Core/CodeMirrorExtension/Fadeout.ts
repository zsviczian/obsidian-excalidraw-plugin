import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

const o30 = Decoration.line({ attributes: {class: "ex-opacity-30"} });
const o15 = Decoration.line({ attributes: {class: "ex-opacity-15"} });
const o8 = Decoration.line({ attributes: {class: "ex-opacity-8"} });
const o5 = Decoration.line({ attributes: {class: "ex-opacity-5"} });
const o0 = Decoration.line({ attributes: {class: "ex-opacity-0"} });

export const HideTextBetweenCommentsExtension = ViewPlugin.fromClass(
  class {
    view: EditorView;
    decorations: DecorationSet;
    reExcalidrawData = /^%%(?:\r\n|\r|\n)# Excalidraw Data$/gm;
    reTextElements = /^%%(?:\r\n|\r|\n)# Text Elements$/gm;
    reDrawing = /^%%(?:\r\n|\r|\n)##? Drawing$/gm;
    linecount = 0;
    isExcalidraw = false;
    
    constructor(view: EditorView) {
      this.view = view;
      this.isExcalidraw = view.state.doc.toString().search(/^excalidraw-plugin: /m) > 0;
      if(!this.isExcalidraw) {
        this.decorations = Decoration.none;
        return;
      }
      this.decorations = this.updateDecorations(view);
    }

    updateDecorations (view: EditorView) {
      const { state } = view;
      const { doc } = state;
      
      const text = doc.toString();

      let start = text.search(this.reExcalidrawData);
      if(start == -1) {
        start = text.search(this.reTextElements);
      }
      if(start == -1) {
        start = text.search(this.reDrawing);
      }
      if(start == -1) return Decoration.none;
      
      const startLine = doc.lineAt(start).number;
      const endLine = doc.lines;
      let builder = new RangeSetBuilder<Decoration>()
      for (let l = startLine; l <= endLine; l++) {
        const line = doc.line(l);
        const pos = l-startLine;
        builder.add(line.from, line.from, 
          pos == 0 ? o30 : (pos == 1) ? o15 : (pos < 6) ? o8 : (pos < 12) ? o5 : o0);
      }
      return builder.finish()
    }

    update(update: ViewUpdate) {
      if (this.isExcalidraw && update.docChanged) {
        this.decorations = this.updateDecorations(update.view)
      }
    }
  },
  {
    decorations: (x) => x.decorations,
  }
);