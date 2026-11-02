/** Execute the whole initial-fit module across rendering, user resize and retirement races. */
import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";

const harness = sourceHarness({
  "../../constants/constants": { CARD_WIDTH: 400, CARD_HEIGHT: 500, CaptureUpdateAction: { IMMEDIATELY: "IMMEDIATELY" } },
  "../../utils/excalidrawElementUtils": { cloneElement: element => ({ ...element, version: (element.version || 0) + 1 }) },
});
const { fitPastedCodeBlockCard } = await harness.importModule("src/view/managers/pastedCodeCardSizing.ts");
test.after(() => harness.close());

async function exercise(configure, verify) {
  const RealDate = globalThis.Date, previousWindow = globalThis.window;
  let now = 0;
  const calls = [], timers = [], doc = {}, element = { id: "new", type: "embeddable", width: 400, height: 500, y: 20 }, other = { id: "existing", height: 600 };
  const pre = { getBoundingClientRect: () => ({ bottom: 64, height: 48 }) };
  const preview = { scrollTop: 0, querySelector: () => pre };
  const container = { isConnected: true, ownerDocument: doc, querySelector: () => preview, getBoundingClientRect: () => ({ top: 0, width: 400 }) };
  let elements = [element, other];
  const api = { getSceneElements: () => elements,
    updateScene(scene) { calls.push(scene); elements = scene.elements; } };
  const view = { excalidrawAPI: api, file: {}, ownerDocument: doc, isClosingOrMigrating: () => false,
    ownerWindow: { getComputedStyle: () => ({ marginBottom: "16px", paddingBottom: "16px" }), setTimeout() { throw Error("popout timer used"); } },
    getEmbeddableLeafElementById: () => ({ node: { containerEl: container } }) };
  const f = { calls, timers, get element() { return elements[0]; }, original: element, other, pre, preview, container, api, view, onTick() {} };
  globalThis.Date = class extends RealDate { static now() { return now; } };
  globalThis.window = { setTimeout(callback, delay) { timers.push(delay); now += delay; f.onTick(); callback(); return timers.length; } };
  try { configure(f); await fitPastedCodeBlockCard(view, "new"); verify(f); }
  finally { globalThis.Date = RealDate; if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
}

test("initial code fit clamps short and long content and preserves width, other cards and insertion history", async () => {
  for (const [bottom, height] of [[64, 100], [360, 392], [4000, 1000]]) {
    await exercise(f => f.pre.getBoundingClientRect = () => ({ bottom, height: bottom }), f => {
      assert.equal(f.element.height, height); assert.equal(f.element.width, 400); assert.equal(f.other.height, 600);
      assert.equal(f.element.y + f.element.height / 2, 270, "initial paste center preserved");
      assert.equal(f.original.height, 500, "change is immutable for the store comparison");
      assert.notEqual(f.original, f.element); assert.equal(f.calls.length, 1);
      assert.equal(f.calls[0].captureUpdate, "IMMEDIATELY"); assert.ok(f.timers.length >= 2);
    });
  }
});
test("initial code fit accounts for owning preview scale and scroll", async () => {
  await exercise(f => { f.container.getBoundingClientRect = () => ({ top: 20, width: 800 }); f.pre.getBoundingClientRect = () => ({ bottom: 420, height: 160 }); f.preview.scrollTop = 20; },
    f => assert.equal(f.element.height, 252));
});
test("manual resizing before or during rendering cancels the initial fit", async () => {
  for (const during of [false, true]) await exercise(f => {
    const resize = () => { f.element.width = 450; f.element.height = 270; };
    if (during) f.onTick = resize; else resize();
  }, f => { assert.equal(f.element.height, 270); assert.equal(f.element.width, 450); assert.equal(f.calls.length, 1); assert.equal(f.calls[0].captureUpdate, "IMMEDIATELY"); });
});
test("retired APIs, changed files and closing views cannot resize a replacement editor", async () => {
  for (const retire of [f => f.view.excalidrawAPI = {}, f => f.view.file = {}, f => f.view.isClosingOrMigrating = () => true]) {
    await exercise(f => f.onTick = () => retire(f), f => assert.deepEqual(f.calls, []));
  }
});
test("missing or detached previews have a bounded wait and no resize side effects", async () => {
  for (const configure of [f => f.view.excalidrawAPI = null, f => f.view.file = null, f => f.view.getEmbeddableLeafElementById = () => null,
    f => f.view.getEmbeddableLeafElementById = () => ({ leaf: { view: { containerEl: f.container } } }),
    f => f.container.isConnected = false, f => f.container.ownerDocument = {}, f => f.container.querySelector = () => null,
    f => f.container.getBoundingClientRect = () => ({ top: 0, width: 0 }), f => f.pre.getBoundingClientRect = () => ({ bottom: 0, height: 0 })]) {
    await exercise(configure, f => {
      assert.ok(f.calls.every(call => !call.target), "fallback cannot resize");
      if (f.view.file && f.view.excalidrawAPI) { assert.equal(f.calls.length, 1); assert.equal(f.calls[0].captureUpdate, "IMMEDIATELY", "fallback insertion remains undoable"); }
      else assert.equal(f.calls.length, 0);
      assert.ok(f.timers.length <= 60); assert.equal(f.element.height, 500);
    });
  }
});
