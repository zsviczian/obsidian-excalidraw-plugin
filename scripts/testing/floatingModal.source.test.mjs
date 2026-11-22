import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";

test("closing a floating modal before deferred setup cancels its listeners and positioning", async () => {
  const previousWindow = globalThis.window, previousDocument = globalThis.mainDocument;
  const pending = new Map(); let nextId = 0, setups = 0;
  const win = {
    innerWidth: 1000, innerHeight: 800,
    setTimeout(callback) { const id = ++nextId; pending.set(id, callback); return id; },
    clearTimeout(id) { pending.delete(id); },
  };
  const doc = Object.assign(new EventTarget(), { defaultView: win, body: {}, activeElement: null });
  const element = () => Object.assign(new EventTarget(), {
    ownerDocument: doc, style: {},
    addClass() { setups++; }, setAttr() {}, querySelector() { return null; },
    getBoundingClientRect() { return { width: 200, height: 100 }; },
  });
  class Modal {
    constructor(app) { this.app = app; this.modalEl = element(); this.containerEl = element(); this.bgEl = element(); }
    setDimBackground() {} open() {} close() {}
  }
  globalThis.window = win; globalThis.mainDocument = doc;
  const graph = sourceHarness({
    obsidian: { Modal },
    "src/utils/styleUtils": { setStyle: (el, styles) => Object.assign(el.style, styles) },
    "src/utils/coreUtils": { errorlog(error) { throw error; } },
    "src/utils/typechecks": {
      isInstanceOfHTMLButtonElement: () => false, isInstanceOfHTMLInputElement: () => false,
      isInstanceOfHTMLSelectElement: () => false, isInstanceOfHTMLTextAreaElement: () => false,
    },
  });
  try {
    const { FloatingModal } = await graph.importModule("src/shared/Dialogs/FloatingModal.ts");
    const modal = new FloatingModal({ keymap: { popScope() {} } });
    modal.open(); assert.equal(pending.size, 1);
    modal.close(); assert.equal(pending.size, 0);
    for (const callback of pending.values()) callback();
    assert.equal(setups, 0);
    modal.close();
    assert.equal(pending.size, 0);
  } finally {
    graph.close();
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.mainDocument; else globalThis.mainDocument = previousDocument;
  }
});
