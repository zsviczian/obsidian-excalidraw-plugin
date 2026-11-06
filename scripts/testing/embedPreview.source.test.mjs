/** Whole production viewer with a minimal owned DOM; native input is tested separately. */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";

const document = { defaultView: { closed: false }, activeElement: null };
let listeners = 0;
class Element {
  constructor(options = {}) { this.children = []; this.attrs = { ...options.attr }; this.classes = new Set((options.cls || "").split(" ")); this.events = new Map(); this.style = {}; this.ownerDocument = document; this.isConnected = true; this.captures = new Set(); }
  createDiv(options) { return this.createEl("div", typeof options === "string" ? { cls: options } : options); }
  createEl(tag, options) { const el = new Element(options); el.tag = tag; this.append(el); return el; }
  append(el) { el.parent = this; this.children.push(el); }
  addClass(cls) { this.classes.add(cls); }
  setAttribute(key, value) { this.attrs[key] = value; }
  getAttribute(key) { return this.attrs[key] ?? null; }
  setText(text) { this.text = text; }
  focus() { document.activeElement = this; }
  remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(el => el !== this); }
  empty() { for (const child of [...this.children]) child.remove(); }
  find(cls) { return this.children.find(el => el.classes.has(cls)) ?? this.children.map(el => el.find(cls)).find(Boolean); }
  fire(name, event = {}) { const e = { preventDefault() { this.prevented = true; }, ...event }; for (const callback of [...this.events.get(name) || []]) callback(e); return e; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
}
class Component {
  cleanups = [];
  load() {}
  registerDomEvent(el, event, callback) {
    if (!el.events.has(event)) el.events.set(event, new Set());
    el.events.get(event).add(callback); listeners++;
    this.cleanups.push(() => { el.events.get(event).delete(callback); listeners--; });
  }
  unload() { for (const cleanup of this.cleanups.splice(0)) cleanup(); }
}
class Modal {
  constructor() { this.modalEl = new Element(); this.contentEl = this.modalEl.createDiv(); }
  setTitle(title) { this.title = title; }
  open() { this.onOpen(); }
  close() { this.onClose(); this.modalEl.remove(); }
}
const graph = sourceHarness({ obsidian: { Component, Modal, setIcon() {}, setTooltip() {} }, "src/lang/helpers": { t: key => key }, "src/utils/styleUtils": { setStyle: (el, values) => Object.assign(el.style, values) } });
const { DrawingEmbedPreviewModal } = await graph.importModule("src/shared/Dialogs/DrawingEmbedPreviewModal.ts");
after(() => graph.close());
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  let resolve, reject, isCurrent, closed = 0;
  const discarded = [], opener = new Element(), promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  const modal = new DrawingEmbedPreviewModal({}, { create: active => { isCurrent = active; return promise; }, discard: el => discarded.push(el) }, opener, () => closed++);
  modal.open();
  return { modal, opener, resolve, reject, discarded, current: () => isCurrent(), closed: () => closed };
}

test("closing during fullscreen export cancels ownership and discards only the late private payload", async () => {
  const f = fixture(), privateImage = new Element();
  assert.equal(f.current(), true); assert.ok(listeners > 0);
  f.modal.close(); assert.equal(f.current(), false); assert.equal(listeners, 0);
  f.resolve(privateImage); await flush();
  assert.deepEqual(f.discarded, [privateImage]); assert.equal(f.closed(), 1); assert.equal(document.activeElement, f.opener);
});

test("fullscreen zoom, fit, pan and pinch own their handlers and private image lifetime", async () => {
  const f = fixture(), image = new Element(); f.resolve(image); await flush();
  const stage = f.modal.contentEl.find("excalidraw-embed-preview-stage"), surface = stage.find("excalidraw-embed-preview-surface");
  assert.ok(surface.children.includes(image));
  f.modal.modalEl.fire("keydown", { key: "+", target: f.modal.contentEl.find("excalidraw-embed-preview-toolbar").children[0] }); assert.equal(Number(stage.getAttribute("data-zoom")), 1.25);
  f.modal.modalEl.fire("keydown", { key: "ArrowRight", target: stage }); assert.match(surface.style.transform, /-24px/);
  f.modal.modalEl.fire("keydown", { key: "0", target: stage }); assert.equal(stage.getAttribute("data-zoom"), "1");
  stage.fire("pointerdown", { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
  stage.fire("pointerdown", { button: 0, pointerId: 2, clientX: 30, clientY: 10 });
  stage.fire("pointermove", { pointerId: 2, clientX: 50, clientY: 10 });
  assert.equal(Number(stage.getAttribute("data-zoom")), 2);
  assert.equal(surface.fire("click").prevented, true);
  f.modal.close(); assert.equal(listeners, 0); assert.equal(stage.captures.size, 0); assert.deepEqual(f.discarded, [image]);
});

test("failed fullscreen export reports failure and a detached opener is never focused", async () => {
  const f = fixture(); f.reject(Error("export failed")); await flush();
  assert.equal(f.modal.contentEl.find("excalidraw-embed-preview-status").text, "EMBED_PREVIEW_FAILED");
  f.opener.isConnected = false; document.activeElement = null;
  f.modal.close(); assert.equal(document.activeElement, null); assert.equal(listeners, 0); assert.deepEqual(f.discarded, []);
});
