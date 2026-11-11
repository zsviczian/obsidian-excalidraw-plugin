import assert from "node:assert/strict";
import test, { after } from "node:test";
import { EditorState, Transaction } from "@codemirror/state";
import { history, undo, redo } from "@codemirror/commands";
import { sourceHarness } from "./sourceHarness.mjs";
import { embedTestDOM } from "./embedTestDOM.mjs";

const graph = sourceHarness();
const { rewriteEmbedPadding, withAreaPadding } = await graph.importModule("src/core/editor/embedPadding.ts");
const { DrawingEmbedSource } = await graph.importModule("src/core/editor/embedSource.ts");
after(() => graph.close());

test("padding edits preserve wiki, Markdown, encoded paths, titles, aliases and escaped table delimiters", () => {
  for (const [text, expected] of [
    ["![[../Map#^area=abcdefgh|Caption|200x100|left]]", "![[../Map#^area=abcdefgh,padding=50|Caption|200x100|left]]"],
    ["![[Map#area=Frame name,padding=.5\\|200\\|right]]", "![[Map#area=Frame name,padding=50\\|200\\|right]]"],
    ['![Caption|200](Map%20one#%5Earea=abcdefgh,padding=1.5 "Keep title")', '![Caption|200](Map%20one#%5Earea=abcdefgh,padding=50 "Keep title")'],
    ['![Map](<../Map one#^area=abcdefgh> "same Map")', '![Map](<../Map one#^area=abcdefgh,padding=50> "same Map")'],
    ["![[#^area=abcdefgh]]", "![[#^area=abcdefgh,padding=50]]"],
    ["![[100% Map#^area=abcdefgh]]", "![[100% Map#^area=abcdefgh,padding=50]]"],
    ['![Map](Map%20one%23%5Earea%3Dabcdefgh%2Cpadding%3D10 "Keep")', '![Map](Map%20one%23%5Earea%3Dabcdefgh,padding=50 "Keep")'],
  ]) assert.equal(rewriteEmbedPadding(text, 50), expected);
  assert.equal(rewriteEmbedPadding("![[Map#^area=abcdefgh,padding=50|200]]", null), "![[Map#^area=abcdefgh|200]]");
  for (const target of ["Map#^text", "Map#^group=", "Map#^area=", "Map#^area=abc,padding=-1", "Map#^area=abc,padding=1,padding=2"])
    assert.equal(withAreaPadding(target, 10), null, target);
  for (const value of [-1, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) assert.equal(withAreaPadding("Map#^area=abc", value), null);
  assert.equal(withAreaPadding("Map#^area=abc", 5000), "Map#^area=abc,padding=5000");
  assert.equal(withAreaPadding("Map#^frame=Part, One,padding=20", 50), "Map#^frame=Part, One,padding=50");
  assert.equal(withAreaPadding("Map#^clippedframe=Part,padding=20, Two", 50), "Map#^clippedframe=Part,padding=20, Two,padding=50");
});

test("padding changes only the owned repeated occurrence in one undo step and preserves target guards", () => {
  const token = "![[Map#^area=abcdefgh|200]]", doc = token + "\n" + token;
  let state = EditorState.create({ doc, extensions: [history()] }), writes = 0;
  const view = { get state() { return state; }, dispatch(spec) { const tr = spec instanceof Transaction ? spec : state.update(spec); state = tr.state; if (tr.docChanged) writes++; } };
  const binding = new DrawingEmbedSource(view, token.length + 1, doc.length, token, () => true);
  assert.equal(binding.replace("![[Other#^area=abcdefgh|200]]"), false);
  assert.equal(binding.replacePadding(50), true);
  assert.equal(state.doc.toString(), token + "\n![[Map#^area=abcdefgh,padding=50|200]]");
  assert.equal(writes, 1); assert.equal(binding.replacePadding(100), false);
  assert.equal(undo(view), true); assert.equal(state.doc.toString(), doc);
  assert.equal(redo(view), true); assert.match(state.doc.toString(), /padding=50/);
});

test("padding never writes through a stale source, owner or physical table-cell range", () => {
  for (const kind of ["owner", "range", "source"]) {
    const text = "![[Map#^area=abcdefgh|200]]";
    let state = EditorState.create({ doc: text }), writes = 0;
    const view = { get state() { return state; }, dispatch() { writes++; } };
    const binding = new DrawingEmbedSource(view, 0, text.length, text, () => kind !== "owner", () => kind !== "range");
    if (kind === "source") state = state.update({ changes: { from: 3, to: 6, insert: "New" } }).state;
    assert.equal(binding.replacePadding(50), false, kind); assert.equal(writes, 0);
  }
});

async function fixture({ value = 10, target = "Map", getMax } = {}) {
  const dom = embedTestDOM(), timers = new Map(), requests = [], discarded = [], writes = [];
  let id = 0, current = true, closed = 0;
  dom.document.events = new Map(); dom.document.body = new dom.Element(); dom.window.innerHeight = 600;
  dom.window.setTimeout = callback => { timers.set(++id, callback); return id; };
  dom.window.clearTimeout = id => timers.delete(id);
  const previous = globalThis.window; globalThis.window = dom.window;
  class SliderComponent {
    constructor(parent) { this.sliderEl = parent.createEl("input", { cls: "slider", attr: { type: "range" } }); }
    setLimits(min, max, step) { for (const [key, value] of Object.entries({ min, max, step })) this.sliderEl.setAttribute(key, String(value)); return this; }
    setValue(value) { this.sliderEl.value = String(value); return this; }
  }
  const module = sourceHarness({ obsidian: { Component: dom.Component, Notice: class {}, SliderComponent, setIcon() {}, setTooltip() {} },
    "src/lang/helpers": { t: key => key }, "src/utils/styleUtils": { setStyle: (el, values) => Object.assign(el.style, values) } });
  const { DrawingEmbedPaddingControl } = await module.importModule("src/core/managers/DrawingEmbedPaddingControl.ts");
  const frame = new dom.Element(), toolbar = frame.createDiv({ cls: "excalidraw-embed-toolbar" }), opener = toolbar.createEl("button"), original = frame.createEl("img", { cls: "excalidraw-embedded-img" });
  const actions = { target, isCurrent: () => current, discard: image => discarded.push(image), padding: { value, getMax,
    create: (value, active) => new Promise(resolve => requests.push({ value, active, resolve })) } };
  const source = { isCurrent: () => current, replacePadding: value => { writes.push(value); return true; } };
  const popup = new DrawingEmbedPaddingControl(frame, opener, actions, source, () => closed++); popup.load();
  const root = dom.document.body.children[0], slider = root.querySelector("input");
  const flush = () => { for (const [id, callback] of timers) { timers.delete(id); callback(); } };
  const change = index => { slider.value = String(index); slider.fire("input"); };
  const close = () => { popup.close(false); module.close(); globalThis.window = previous; assert.equal(dom.listenerCount(), 0); assert.equal(timers.size, 0); };
  return { ...dom, frame, toolbar, opener, original, root, popup, slider, requests, discarded, writes, timers, change, flush, close, closed: () => closed, current: value => { current = value; } };
}

test("padding row aligns beneath the whole toolbar, stays onscreen, and exposes disclosure state", async () => {
  const f = await fixture();
  try {
    f.toolbar.bounds = { left: 550, right: 730, top: 100, bottom: 132, width: 180, height: 32 };
    f.opener.bounds = { left: 610, right: 638, top: 102, bottom: 130, width: 28, height: 28 };
    f.root.bounds = { left: 0, right: 240, top: 0, bottom: 36, width: 240, height: 36 };
    f.fire(f.window, "resize");
    assert.equal(f.root.style.left, "490px"); assert.equal(f.root.style.top, "136px");
    assert.equal(f.opener.getAttribute("aria-expanded"), "true");
    assert.equal(f.slider.getAttribute("min"), "0");
    assert.equal(f.slider.getAttribute("max"), "100");
    assert.equal(f.slider.getAttribute("step"), "1");
    assert.equal(f.root.children[0].hasClass("excalidraw-embed-padding-row"), true);
    assert.equal(f.root.children[1].hasClass("excalidraw-padding-value"), true);
    assert.equal(f.root.children[2].hasClass("excalidraw-embed-padding-help"), true);
    assert.equal(f.root.querySelector(".excalidraw-embed-padding-heading"), null);
    assert.equal(f.root.children.length, 3, "controls, value and description occupy separate rows");
    f.toolbar.bounds = { ...f.toolbar.bounds, top: 580, bottom: 612 };
    f.fire(f.window, "resize"); assert.equal(f.root.style.top, "540px", "near the bottom the row flips above its toolbar");
    f.popup.close(false); assert.equal(f.opener.getAttribute("aria-expanded"), "false");
  } finally { f.close(); }
});

test("padding previews debounce without writing; closing commits exactly once and releases fresh payloads", async () => {
  const f = await fixture();
  try {
    f.change(2); f.change(3); assert.equal(f.timers.size, 1); assert.equal(f.requests.length, 0); f.flush();
    assert.equal(f.requests[0].value, 3); assert.deepEqual(f.writes, []);
    const preview = new f.Element(); f.requests[0].resolve(preview); await Promise.resolve();
    assert.equal(f.frame.children.includes(f.original), true, "original widget and source identity remain stable");
    assert.equal(f.frame.hasClass("excalidraw-embed-padding-previewing"), true);
    f.popup.close(true); f.popup.close(true);
    assert.deepEqual(f.writes, [3]); assert.deepEqual(f.discarded, [preview]); assert.equal(f.closed(), 1);
    assert.equal(f.document.body.children.length, 0); assert.equal(f.frame.hasClass("excalidraw-embed-padding-previewing"), false);
  } finally { f.close(); }
});

test("newer padding previews win; late exports after Escape, unload or stale source are discarded", async () => {
  for (const cancel of ["Escape", "unload", "source"]) {
    const f = await fixture();
    try {
      f.change(2); f.flush(); f.change(3); f.flush();
      const old = new f.Element(); f.requests[0].resolve(old); await Promise.resolve();
      assert.deepEqual(f.discarded, [old]); assert.equal(f.requests[0].active(), false);
      if (cancel === "Escape") f.fire(f.document, "keydown", { key: "Escape" });
      if (cancel === "unload") f.popup.unload();
      if (cancel === "source") { f.current(false); f.popup.close(true); }
      const late = new f.Element(); f.requests[1].resolve(late); await Promise.resolve();
      assert.deepEqual(f.discarded, [old, late]); assert.deepEqual(f.writes, []); assert.equal(f.requests[1].active(), false);
    } finally { f.close(); }
  }
});

test("padding wheel, outside close and default reset use the configured gesture without duplicate writes", async () => {
  const f = await fixture();
  try {
    f.slider.fire("wheel", { deltaY: -1 });
    f.fire(f.document, "pointerdown", { composedPath: () => [f.document] });
    assert.deepEqual(f.writes, [11]); assert.equal(f.timers.size, 0);
  } finally { f.close(); }
  const reset = await fixture();
  try { reset.root.querySelector("button").fire("click"); assert.deepEqual(reset.writes, [null]); }
  finally { reset.close(); }
});

test("area limits load once before the gesture and stay fixed across value digit changes", async () => {
  let calls=0, resolve;
  const limit=new Promise(done=>{resolve=done;});
  const f=await fixture({target:"Map#^area=a",getMax:()=>{calls++;return limit;}});
  try{
    assert.equal(f.slider.disabled,true);assert.equal(calls,1);
    resolve(5432);await Promise.resolve();await Promise.resolve();
    assert.equal(f.slider.disabled,false);assert.equal(f.slider.getAttribute("max"),"5432");
    f.change(9);f.change(100);f.change(2000);
    assert.equal(f.slider.getAttribute("max"),"5432");assert.equal(calls,1);
    assert.equal(f.root.children[1].text,"2000");
    assert.equal(f.root.children[0].querySelector("output"),null,"readout must not affect the track row");
    f.popup.close(true);assert.deepEqual(f.writes,[2000]);
  }finally{f.close();}
  let resolveStale;
  const stale=await fixture({target:"Map#^area=a",getMax:()=>new Promise(done=>{resolveStale=done;})});
  try{
    stale.popup.close(false);resolveStale(9000);await Promise.resolve();await Promise.resolve();
    assert.equal(stale.slider.disabled,true,"a closed popup must ignore the completed range read");
    assert.deepEqual(stale.writes,[]);
  }finally{stale.close();}
});

test("opening a capped padding control preserves larger saved values until edited", async () => {
  const f=await fixture({value:750});
  try{
    assert.equal(f.slider.value,"100");assert.equal(f.root.children[1].text,"750");
    f.popup.close(true);assert.deepEqual(f.writes,[]);
  }finally{f.close();}
});
