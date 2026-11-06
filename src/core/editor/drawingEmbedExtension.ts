import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { editorInfoField, editorLivePreviewField } from "obsidian";
import type ExcalidrawPlugin from "../main";
import { DrawingEmbedControls } from "../managers/DrawingEmbedControls";
import { getDrawingEmbedActions } from "../managers/drawingEmbedActions";
import { DrawingEmbedSource } from "./embedSource";
import { readDrawingEmbedToken } from "./embedDimensions";

interface OwnedEmbed {
  image: HTMLElement;
  source: DrawingEmbedSource;
  controls: DrawingEmbedControls;
}

function decodeTarget(target: string): string {
  const unescaped = target.replace(/\\([\\[\]()<>!| ])/g, "$1");
  try { return decodeURI(unescaped); } catch { return unescaped; }
}

function readWidgetToken(view: EditorView, element: HTMLElement): { from: number; text: string; target: string } | null {
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
  const rangeText = view.state.doc.sliceString(from, boundaryTo), token = readDrawingEmbedToken(rangeText);
  return token && !rangeText.slice(token.text.length).trim() ? { from, text: token.text, target: token.target } : null;
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
      if (!sourceFile || !view.state.field(editorLivePreviewField, false) ||
          view.state.facet(EditorState.readOnly) || !view.state.facet(EditorView.editable) || plugin.isExcalidrawFile(sourceFile)) {
        this.clear(); return;
      }
      const seen = new Set<HTMLElement>();
      for (const image of view.contentDOM.querySelectorAll<HTMLElement>(".excalidraw-embedded-img")) {
        const nativeEmbed = image.closest<HTMLElement>(".internal-embed"), frame = image.parentElement;
        const actions = getDrawingEmbedActions(image);
        if (!nativeEmbed || !frame || !actions || !actions.isCurrent() || image.closest(".cm-content") !== view.contentDOM ||
            nativeEmbed.closest(".markdown-embed, .hover-popover, .canvas-node-content, .print, .cm-preview-code-block")) continue;
        seen.add(nativeEmbed);
        const existing = this.entries.get(nativeEmbed);
        if (existing?.image === image && existing.source.isCurrent()) continue;
        if (existing) { existing.source.invalidate(); existing.controls.unload(); this.entries.delete(nativeEmbed); }
        const token = readWidgetToken(view, nativeEmbed);
        if (!token) continue;
        const from = token.from;
        const target = decodeTarget(token.target), hash = target.indexOf("#");
        const path = hash < 0 ? target : target.slice(0, hash), reference = hash < 0 ? "" : target.slice(hash);
        const drawing = plugin.app.metadataCache.getFirstLinkpathDest(path, sourceFile.path);
        if (!drawing || !plugin.isExcalidrawFile(drawing) || decodeTarget(drawing.path + reference) !== decodeTarget(actions.target)) continue;
        const sourcePath = sourceFile.path, ownerDocument = view.dom.ownerDocument;
        const source = new DrawingEmbedSource(view, from, from + token.text.length, token.text, () =>
          this.active && !disposed && sourceFile.path === sourcePath &&
          view.state.field(editorInfoField, false)?.file === sourceFile &&
          !!view.state.field(editorLivePreviewField, false) && !view.state.facet(EditorState.readOnly) && view.state.facet(EditorView.editable) &&
          frame.isConnected && view.contentDOM.contains(frame) && nativeEmbed.contains(frame) &&
          frame.ownerDocument === ownerDocument && view.dom.ownerDocument === ownerDocument && actions.isCurrent());
        // A renderer may invalidate its generation before replacing the DOM.
        // Do not mount a stale binding: mounting/unloading it would schedule
        // another DOM sync and starve the renderer's debounce timer.
        if (!source.isCurrent()) { source.invalidate(); continue; }
        const controls = new DrawingEmbedControls(frame, actions, source);
        try { controls.load(); }
        catch (error) { source.invalidate(); controls.unload(); throw error; }
        this.entries.set(nativeEmbed, { image, source, controls });
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
