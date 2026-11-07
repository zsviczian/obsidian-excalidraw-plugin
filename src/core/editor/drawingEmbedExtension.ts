import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { editorInfoField, editorLivePreviewField, MarkdownView } from "obsidian";
import type ExcalidrawPlugin from "../main";
import { DrawingEmbedControls } from "../managers/DrawingEmbedControls";
import { getDrawingEmbedActions } from "../managers/drawingEmbedActions";
import { DrawingEmbedSource } from "./embedSource";
import { readDrawingEmbedToken } from "./embedDimensions";
import { readTableEmbedToken } from "./tableEmbedSource";
import type { LocatedDrawingEmbed } from "src/types/drawingEmbedTypes";

interface OwnedEmbed {
  image: HTMLElement;
  source: DrawingEmbedSource;
  controls: DrawingEmbedControls;
}

function isSourceMode(view: EditorView): boolean {
  const info = view.state.field(editorInfoField, false);
  return (!(info instanceof MarkdownView) || info.getMode() === "source") &&
    view.dom.closest<HTMLElement>(".markdown-source-view")?.style.display !== "none";
}

function decodeTarget(target: string): string {
  const unescaped = target.replace(/\\([\\[\]()<>!| ])/g, "$1");
  try { return decodeURI(unescaped); } catch { return unescaped; }
}

function widgetRange(view: EditorView, element: HTMLElement): { from: number; to: number } | null {
  const parent = element.parentNode;
  if (!parent) return null;
  let from: number, boundaryFrom: number, boundaryTo: number;
  try {
    const index = Array.from(parent.childNodes).indexOf(element);
    from = view.posAtDOM(element, 0);
    boundaryFrom = view.posAtDOM(parent, index);
    boundaryTo = view.posAtDOM(parent, index + 1);
  } catch {
    // CodeMirror can retire a widget before its DOM is removed.
    return null;
  }
  if (from !== boundaryFrom || boundaryTo <= from || boundaryTo - from > 16384) return null;
  return { from, to: boundaryTo };
}

function readWidgetToken(view: EditorView, element: HTMLElement): LocatedDrawingEmbed | null {
  const range = widgetRange(view, element);
  if (!range) return null;
  const { from, to } = range;
  const rangeText = view.state.doc.sliceString(from, to), token = readDrawingEmbedToken(rangeText);
  return token && !rangeText.slice(token.text.length).trim() ? { from, text: token.text, target: token.target } : null;
}

function readTableWidgetToken(view: EditorView, root: HTMLElement, table: HTMLTableElement, cell: HTMLTableCellElement): LocatedDrawingEmbed | null {
  if (!cell || cell.closest("table") !== table || cell.colSpan !== 1 || cell.rowSpan !== 1) return null;
  const row = cell.parentElement as HTMLTableRowElement;
  if (row.parentElement?.parentElement !== table) return null;
  const range = widgetRange(view, root);
  if (!range) return null;
  return readTableEmbedToken(view.state.doc.sliceString(range.from, range.to), range.from, row.rowIndex, cell.cellIndex, table.rows.length, table.rows[0]?.cells.length ?? 0);
}

/**
 * Public CodeMirror DOM boundaries locate a complete parsed token. Both the
 * source file/editor and the renderer's canonical drawing reference must agree.
 * A filename match, active file, or document-wide occurrence index is never used.
 */
export function createDrawingEmbedExtension(plugin: ExcalidrawPlugin): { extension: Extension; dispose: () => void } {
  let disposed = false;
  const instances = new Set<EmbedEditor>();

  class EmbedEditor {
    private entries = new Map<HTMLElement, OwnedEmbed>();
    private observer: MutationObserver;
    private scheduled = false;
    private active = true;

    constructor(private view: EditorView) {
      instances.add(this);
      const win = view.dom.ownerDocument.defaultView;
      this.observer = new win.MutationObserver(() => this.schedule());
      this.observer.observe(view.contentDOM, { childList: true, subtree: true });
      const source = view.dom.closest<HTMLElement>(".markdown-source-view");
      if (source) this.observer.observe(source, { attributes: true, attributeFilter: ["class", "style"] });
      this.schedule();
    }

    update(update: ViewUpdate): void {
      if (update.docChanged) for (const entry of this.entries.values()) entry.source.map(update.changes);
      if (update.docChanged || update.viewportChanged || update.selectionSet || update.geometryChanged) this.schedule();
    }

    private schedule(): void {
      if (!this.active || disposed || this.scheduled) return;
      this.scheduled = true;
      // Read widget DOM after the editor's transaction/DOM update has finished.
      queueMicrotask(() => { this.scheduled = false; if (this.active && !disposed) this.sync(); });
    }

    private clear(): void {
      for (const entry of this.entries.values()) { entry.source.invalidate(); entry.controls.unload(); }
      this.entries.clear();
    }

    private sync(): void {
      const view = this.view, info = view.state.field(editorInfoField, false), sourceFile = info?.file;
      if (!sourceFile || !isSourceMode(view) || !view.state.field(editorLivePreviewField, false) ||
          view.state.facet(EditorState.readOnly) || !view.state.facet(EditorView.editable)) {
        this.clear(); return;
      }
      const seen = new Set<HTMLElement>();
      for (const image of view.contentDOM.querySelectorAll<HTMLElement>(".excalidraw-embedded-img")) {
        const nativeEmbed = image.closest<HTMLElement>(".internal-embed"), frame = image.parentElement;
        const table = nativeEmbed ? null : image.closest<HTMLTableElement>("table.table-editor");
        const cell = table && image.closest<HTMLTableCellElement>("td, th");
        const root = nativeEmbed ?? table?.closest<HTMLElement>(".cm-table-widget");
        const key = nativeEmbed ?? frame;
        const actions = getDrawingEmbedActions(image);
        if (!root || !frame || !actions || !actions.isCurrent() || image.closest(".cm-content") !== view.contentDOM ||
            root.closest(".markdown-embed, .hover-popover, .canvas-node-content, .print, .cm-preview-code-block")) continue;
        seen.add(key);
        const existing = this.entries.get(key);
        if (existing?.image === image && existing.source.isCurrent()) continue;
        if (existing) { existing.source.invalidate(); existing.controls.unload(); this.entries.delete(key); }
        const token = table ? readTableWidgetToken(view, root, table, cell) : readWidgetToken(view, root);
        if (!token) continue;
        const from = token.from;
        const target = decodeTarget(token.target), hash = target.indexOf("#");
        const path = hash < 0 ? target : target.slice(0, hash), reference = hash < 0 ? "" : target.slice(hash);
        const drawing = plugin.app.metadataCache.getFirstLinkpathDest(path, sourceFile.path);
        if (!drawing || !plugin.isExcalidrawFile(drawing) || decodeTarget(drawing.path + reference) !== decodeTarget(actions.target)) continue;
        const sourcePath = sourceFile.path, ownerDocument = view.dom.ownerDocument;
        const row = cell?.parentElement as HTMLTableRowElement | undefined;
        const rowIndex = row?.rowIndex, columnIndex = cell?.cellIndex;
        const source = new DrawingEmbedSource(view, from, from + token.text.length, token.text, () =>
          this.active && !disposed && sourceFile.path === sourcePath &&
          view.state.field(editorInfoField, false)?.file === sourceFile &&
          isSourceMode(view) &&
          !!view.state.field(editorLivePreviewField, false) && !view.state.facet(EditorState.readOnly) && view.state.facet(EditorView.editable) &&
          frame.isConnected && view.contentDOM.contains(frame) && root.contains(frame) &&
          (!table || cell?.parentElement === row && row.rowIndex === rowIndex && cell.cellIndex === columnIndex) &&
          frame.ownerDocument === ownerDocument && view.dom.ownerDocument === ownerDocument && actions.isCurrent(),
          table ? (from, to) => {
            const current = readTableWidgetToken(view, root, table, cell);
            return current?.from === from && from + current.text.length === to && current.text === token.text;
          } : undefined);
        // A renderer may invalidate its generation before replacing the DOM.
        // Do not mount a stale binding: mounting/unloading it would schedule
        // another DOM sync and starve the renderer's debounce timer.
        if (!source.isCurrent()) { source.invalidate(); continue; }
        const controls = new DrawingEmbedControls(frame, actions, source);
        try { controls.load(); }
        catch (error) { source.invalidate(); controls.unload(); throw error; }
        this.entries.set(key, { image, source, controls });
      }
      for (const [element, entry] of this.entries) if (!seen.has(element)) {
        entry.source.invalidate(); entry.controls.unload(); this.entries.delete(element);
      }
    }

    destroy(): void {
      if (!this.active) return;
      this.active = false; this.observer.disconnect(); this.clear(); instances.delete(this);
    }
  }

  return {
    extension: ViewPlugin.fromClass(EmbedEditor),
    dispose: () => { disposed = true; for (const instance of [...instances]) instance.destroy(); },
  };
}
