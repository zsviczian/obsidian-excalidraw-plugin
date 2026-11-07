/** Exercise the real bridge's scheduling with public CM ranges and controlled DOM observers. */
import assert from "node:assert/strict";
import test from "node:test";
import { EditorState, StateField } from "@codemirror/state";
import * as cmView from "@codemirror/view";
import { sourceHarness } from "./sourceHarness.mjs";

for (const selfEmbed of [false, true]) test(selfEmbed
  ? "drawing Markdown self-embeds retain controls and the same lifecycle guards"
  : "invalid render generations cannot remount controls or starve the renderer debounce", async () => {
  const pending = [], originalQueue = globalThis.queueMicrotask, observers = [];
  let generation = true, loaded = 0, unloaded = 0, retireWhileMapping = false;
  globalThis.queueMicrotask = callback => pending.push(callback);
  const drawing = { path: "Map.excalidraw.md" }, file = selfEmbed ? drawing : { path: "Source.md" }, text = "![[Map.excalidraw.md|180]]";
  class MarkdownView { mode = "source"; file = file; getMode() { return this.mode; } }
  const info = new MarkdownView(), sourceContainer = { style: { display: "" } };
  const editorInfoField = StateField.define({ create: () => info, update: value => value });
  const editorLivePreviewField = StateField.define({ create: () => true, update: value => value });
  const doc = { defaultView: { MutationObserver: class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.connected = true; (this.targets ??= []).push(target); }
    disconnect() { this.connected = false; }
  } } };
  const frame = { isConnected: true, ownerDocument: doc }, parent = { childNodes: [] };
  const native = { parentNode: parent, closest: () => null, contains: el => el === frame }; parent.childNodes.push(native);
  const contentDOM = { querySelectorAll: () => [image], contains: el => el === frame };
  const image = { parentElement: frame, closest: selector => selector === ".internal-embed" ? native : contentDOM };
  const actions = { target: drawing.path, isCurrent: () => generation };
  const mutation = () => { for (const observer of observers) if (observer.connected) observer.callback(); };
  const graph = sourceHarness({
    obsidian: { editorInfoField, editorLivePreviewField, MarkdownView },
    "@codemirror/view": { ...cmView, ViewPlugin: { fromClass: value => value } },
    "../managers/DrawingEmbedControls": { DrawingEmbedControls: class { load() { loaded++; mutation(); } unload() { unloaded++; mutation(); } } },
    "../managers/drawingEmbedActions": { getDrawingEmbedActions: () => actions },
  });
  try {
    const { createDrawingEmbedExtension } = await graph.importModule("src/core/editor/drawingEmbedExtension.ts");
    const plugin = { isExcalidrawFile: value => value === drawing, app: { metadataCache: { getFirstLinkpathDest: () => drawing } } };
    const bridge = createDrawingEmbedExtension(plugin);
    const view = { dom: { ownerDocument: doc, closest: () => sourceContainer }, contentDOM, state: EditorState.create({ doc: text + "\n", extensions: [editorInfoField, editorLivePreviewField] }),
      posAtDOM(el, offset) { if (retireWhileMapping) generation = false; return el === parent && offset === 1 ? text.length + 1 : 0; } };
    const drain = () => { for (let i = 0; pending.length && i < 10; i++) pending.shift()(); assert.equal(pending.length, 0, "unbounded remount/mutation loop"); };
    new bridge.extension(view); drain(); assert.equal(loaded, 1);
    assert.ok(observers[0].targets.includes(sourceContainer), "source visibility changes must schedule ownership sync");
    info.mode = "preview"; mutation(); drain(); assert.equal(loaded, 1); assert.equal(unloaded, 1);
    info.mode = "source"; sourceContainer.style.display = "none"; mutation(); drain(); assert.equal(loaded, 1);
    sourceContainer.style.display = ""; mutation(); drain(); assert.equal(loaded, 2);
    generation = false; mutation(); drain(); assert.equal(loaded, 2); assert.equal(unloaded, 2);
    generation = true; mutation(); drain(); assert.equal(loaded, 3);
    generation = false; mutation(); drain();
    generation = true; retireWhileMapping = true; mutation(); drain(); assert.equal(loaded, 3, "source invalidated during DOM mapping was mounted");
    bridge.dispose(); drain(); assert.ok(observers.every(observer => !observer.connected));
  } finally { graph.close(); globalThis.queueMicrotask = originalQueue; }
});
