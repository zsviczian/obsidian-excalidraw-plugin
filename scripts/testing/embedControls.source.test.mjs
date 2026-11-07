import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";
import { embedTestDOM } from "./embedTestDOM.mjs";

async function fixture(text = "![[Map|Alias|180x130|left]]") {
  const dom = embedTestDOM(), notices = [], modals = [], writes = [];
  let current = true, sourceCurrent = true, selects = 0, opens = 0;
  const graph = sourceHarness({ obsidian: { Component: dom.Component, MarkdownRenderChild: dom.MarkdownRenderChild, Notice: class { constructor(text) { notices.push(text); } }, setIcon() {}, setTooltip() {} },
    "src/lang/helpers": { t: key => key },
    "src/utils/styleUtils": { setStyle: (el, values) => Object.assign(el.style, values), removeStyle: (el, keys) => { for (const key of keys) delete el.style[key]; } },
    "src/shared/Dialogs/DrawingEmbedPreviewModal": { DrawingEmbedPreviewModal: class { constructor(_app, _preview, _opener, close) { this.onClosed = close; modals.push(this); } open() { this.active = true; } close() { this.active = false; this.onClosed(); } } },
  });
  const { DrawingEmbedControls } = await graph.importModule("src/core/managers/DrawingEmbedControls.ts");
  const content = new dom.Element({ cls: "cm-content" }), frame = content.createDiv();
  const image = frame.createEl("img", { cls: "excalidraw-embedded-img" }); image.bounds = { left: 0, top: 0, right: 180, bottom: 130, width: 180, height: 130 };
  const source = { text, isCurrent: () => sourceCurrent, replace: value => { if (!sourceCurrent) return false; writes.push(value); return true; }, select: () => { selects++; return sourceCurrent; } };
  const controls = new DrawingEmbedControls(frame, { app: {}, target: "Map", isCurrent: () => current, openDrawing: () => opens++, getOpenTooltip: () => "configured open shortcuts" }, source); controls.load();
  const handle = frame.querySelector(".excalidraw-embed-resize-handle"), toolbar = frame.querySelector(".excalidraw-embed-toolbar");
  handle.bounds = { left: 156, top: 106, right: 178, bottom: 128, width: 22, height: 22 };
  const buttons = toolbar.children.filter(element => element.tagName === "BUTTON");
  return { ...dom, frame, image, handle, toolbar, buttons, controls, writes, source, notices, modals, current: value => current = value, sourceCurrent: value => sourceCurrent = value, selects: () => selects, opens: () => opens,
    close: () => { controls.unload(); graph.close(); assert.equal(dom.listenerCount(), 0); assert.ok(dom.observers.every(observer => !observer.connected)); } };
}
function start(f) { f.handle.fire("pointerdown", { button: 0, pointerId: 1, clientX: 180, clientY: 130 }); }

test("toolbar compatibility events cannot activate the surrounding native table cell", async () => {
  const f = await fixture();
  try {
    for (const name of ["mousedown", "touchstart"]) {
      let stopped = false;
      const event = f.toolbar.fire(name, { stopPropagation() { stopped = true; } });
      assert.equal(stopped, true); assert.equal(event.prevented, undefined);
    }
    assert.deepEqual(f.writes, []); assert.equal(f.selects(), 0);
    f.buttons[2].fire("click"); assert.equal(f.selects(), 1);
  } finally { f.close(); }
});

test("resize previews proportionally without writing, then commits once on the owned pointer release", async () => {
  const f = await fixture();
  try {
    start(f); f.fire(f.window, "pointermove", { pointerId: 1, clientX: 220, clientY: 130 });
    assert.deepEqual(f.writes, []); assert.equal(f.frame.style["--excalidraw-embed-resize-width"], "220px");
    assert.equal(Number.parseFloat(f.frame.style["--excalidraw-embed-resize-height"]), 220 / (180 / 130));
    f.fire(f.window, "pointerup", { pointerId: 2 }); assert.deepEqual(f.writes, []);
    f.fire(f.window, "pointerup", { pointerId: 1 });
    assert.deepEqual(f.writes, ["![[Map|Alias|220x159|left]]"]); assert.equal(f.handle.captures.size, 0);
    assert.equal(f.frame.hasClass("excalidraw-embed-resizing"), false);
    assert.equal(f.frame.style["--excalidraw-embed-resize-height"], undefined);
  } finally { f.close(); }
});

test("Escape, lost capture, stale source and visual replacement cancel without stale writes", async () => {
  for (const cancel of ["escape", "capture", "source", "replace", "unload"]) {
    const f = await fixture();
    try {
      start(f); f.fire(f.window, "pointermove", { pointerId: 1, clientX: 200, clientY: 130 });
      if (cancel === "escape") f.fire(f.window, "keydown", { key: "Escape" });
      if (cancel === "capture") f.handle.fire("lostpointercapture");
      if (cancel === "source") f.sourceCurrent(false);
      if (cancel === "replace") {
        f.frame.empty(); f.frame.createEl("img", { cls: "excalidraw-embedded-img" }); f.observers[0].fire();
        assert.equal(f.frame.querySelectorAll(".excalidraw-embed-toolbar").length, 1); assert.equal(f.toolbar.parentElement, f.frame);
      }
      if (cancel === "unload") f.controls.unload();
      f.fire(f.window, "pointerup", { pointerId: 1 }); assert.deepEqual(f.writes, []); assert.equal(f.handle.captures.size, 0);
    } finally { f.close(); }
  }
});

test("keyboard resizing commits once on release, keeps shortcuts, and reset preserves aliases", async () => {
  const f = await fixture();
  try {
    f.handle.fire("keydown", { key: "ArrowRight", ctrlKey: true }); assert.equal(f.frame.hasClass("excalidraw-embed-resizing"), false);
    f.handle.fire("keydown", { key: "ArrowRight" }); f.handle.fire("keydown", { key: "ArrowRight" }); assert.deepEqual(f.writes, []);
    f.handle.fire("keyup", { key: "ArrowRight" }); assert.deepEqual(f.writes, ["![[Map|Alias|196x142|left]]"]);
    f.handle.fire("keydown", { key: "Home" }); assert.equal(f.writes.at(-1), "![[Map|Alias|left]]");
    f.buttons[2].fire("click"); assert.equal(f.selects(), 1);
    f.buttons[1].fire("click"); assert.equal(f.opens(), 1);
    f.buttons[0].fire("click"); assert.equal(f.modals[0].active, true);
  } finally { f.close(); }
  assert.equal(f.modals[0].active, false);
});

test("cancel and viewport changes restore controls to the visible image corner", async () => {
  const f = await fixture();
  try {
    const originalFrame = { ...f.frame.bounds }, originalImage = { ...f.image.bounds };
    f.frame.getBoundingClientRect = () => f.frame.hasClass("excalidraw-embed-resizing") ? { ...originalFrame, right: 220, width: 220, bottom: 159, height: 159 } : originalFrame;
    f.image.getBoundingClientRect = () => f.frame.hasClass("excalidraw-embed-resizing") ? { ...originalImage, right: 220, width: 220, bottom: 159, height: 159 } : originalImage;
    start(f); f.fire(f.window, "pointermove", { pointerId: 1, clientX: 220, clientY: 130 });
    assert.equal(f.frame.style["--excalidraw-embed-control-right"], "2px");
    f.fire(f.window, "keydown", { key: "Escape" });
    assert.equal(f.frame.style["--excalidraw-embed-control-right"], "522px"); assert.deepEqual(f.writes, []);
    originalImage.left = 50; originalImage.right = 230; f.fire(f.window, "resize");
    assert.equal(f.frame.style["--excalidraw-embed-toolbar-right"], "474px");
    assert.equal(f.frame.style["--excalidraw-embed-control-right"], "472px");
  } finally { f.close(); }
});

test("a full-width no-op retains percentage syntax and a replacement gesture uses restored dimensions", async () => {
  const f = await fixture("![[Map|100%]]");
  try {
    f.frame.parentElement.bounds.right = 180;
    start(f); f.fire(f.window, "pointermove", { pointerId: 1, clientX: 200, clientY: 130 });
    f.fire(f.window, "pointerup", { pointerId: 1 }); assert.deepEqual(f.writes, []);
    f.frame.parentElement.bounds.right = 700;
    const original = { ...f.image.bounds };
    f.image.getBoundingClientRect = () => f.frame.hasClass("excalidraw-embed-resizing") ? { ...original, width: Number.parseFloat(f.frame.style["--excalidraw-embed-resize-width"]), height: Number.parseFloat(f.frame.style["--excalidraw-embed-resize-height"]) } : original;
    start(f); f.fire(f.window, "pointermove", { pointerId: 1, clientX: 220, clientY: 130 });
    f.handle.fire("pointerdown", { button: 0, pointerId: 2, clientX: 180, clientY: 130 });
    f.fire(f.window, "pointermove", { pointerId: 2, clientX: 188, clientY: 130 });
    f.fire(f.window, "pointerup", { pointerId: 2 }); assert.deepEqual(f.writes, ["![[Map|188]]"]);
  } finally { f.close(); }
});

test("late image sizing leaves the toolbar inside paint containment and remeasures the changed frame", async () => {
  const f = await fixture();
  try {
    f.toolbar.bounds = { ...f.toolbar.bounds, width: 142, height: 40 };
    f.frame.getBoundingClientRect = () => ({ ...f.frame.bounds, bottom: f.frame.hasClass("excalidraw-embed-controls-below") ? 170 : 130 });
    f.image.bounds = { ...f.image.bounds, bottom: 0, height: 0 };
    f.frame.fire("load"); assert.equal(f.frame.hasClass("excalidraw-embed-controls-below"), true);
    f.image.bounds = { ...f.image.bounds, bottom: 130, height: 130 };
    const observer = f.observers.find(observer => observer.resize); assert.equal(observer.target, f.image);
    observer.fire(); observer.fire();
    assert.equal(f.pendingFrames(), 1); assert.equal(f.frame.hasClass("excalidraw-embed-controls-below"), true);
    f.flushFrames(); assert.equal(f.frame.hasClass("excalidraw-embed-controls-below"), false);
    assert.equal(f.frame.style["--excalidraw-embed-control-top"], "4px");
    assert.equal(f.frame.style["--excalidraw-embed-control-bottom"], "2px");
    observer.fire(); assert.equal(f.pendingFrames(), 1);
  } finally { f.close(); }
  assert.equal(f.pendingFrames(), 0); f.flushFrames();
});
