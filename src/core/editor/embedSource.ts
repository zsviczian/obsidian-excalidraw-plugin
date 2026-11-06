import { isolateHistory } from "@codemirror/commands";
import { ChangeDesc, EditorSelection, Transaction } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { readDrawingEmbedToken } from "./embedDimensions";
import type { EmbedSourceBinding } from "src/types/drawingEmbedTypes";

/**
 * A mapped, validated editor range. The drawing destination never owns these
 * writes. Invalidation is permanent so a retired gesture cannot recover by
 * accidentally matching a different occurrence later.
 */
export class DrawingEmbedSource implements EmbedSourceBinding {
  private valid = true;

  constructor(
    private readonly view: EditorView,
    private from: number,
    private to: number,
    public readonly text: string,
    private readonly ownsSource: () => boolean,
    private readonly validateRange?: (from: number, to: number) => boolean,
  ) {}

  /** Track edits before the token; edits inside it retire this binding. */
  map(changes: ChangeDesc): void {
    if (!this.valid) return;
    changes.iterChangedRanges((from, to) => {
      if ((from < this.to && to > this.from) ||
          (from === to && from > this.from && from < this.to)) this.valid = false;
    });
    this.from = changes.mapPos(this.from, 1);
    this.to = changes.mapPos(this.to, -1);
    this.valid = this.isCurrent();
  }

  /** Revalidate the complete expected token against the current owning editor. */
  isCurrent(): boolean {
    return this.valid && this.ownsSource() && this.from >= 0 && this.to >= this.from &&
      this.to <= this.view.state.doc.length &&
      this.view.state.doc.sliceString(this.from, this.to) === this.text;
  }

  /** Commit a single isolated undoable transaction, retaining the destination. */
  replace(text: string): boolean {
    if (!this.isCurrent() || this.validateRange && !this.validateRange(this.from, this.to)) return false;
    if (text === this.text) return true;
    const original = readDrawingEmbedToken(this.text), next = readDrawingEmbedToken(text);
    if (!original || !next || next.text !== text || next.target !== original.target || next.wiki !== original.wiki) return false;
    this.view.dispatch({
      changes: { from: this.from, to: this.to, insert: text },
      annotations: [Transaction.userEvent.of("input.excalidraw-embed-resize"), isolateHistory.of("full")],
    });
    this.valid = false;
    return true;
  }

  /** Select the containing-note syntax, allowing Live Preview to reveal it. */
  select(): boolean {
    if (!this.isCurrent() || this.validateRange && !this.validateRange(this.from, this.to)) return false;
    this.view.dispatch({ selection: EditorSelection.range(this.from, this.to), scrollIntoView: true });
    this.view.focus();
    return true;
  }

  /** Retire a view, widget or gesture without ever writing stale source. */
  invalidate(): void {
    this.valid = false;
  }
}
