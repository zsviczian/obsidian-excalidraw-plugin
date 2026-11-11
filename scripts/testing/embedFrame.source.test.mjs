import assert from "node:assert/strict";
import test, { after } from "node:test";
import { EditorState, Transaction } from "@codemirror/state";
import { history, undo } from "@codemirror/commands";
import { sourceHarness } from "./sourceHarness.mjs";
const graph = sourceHarness();
const { rewriteEmbedFrame } = await graph.importModule("src/core/editor/embedFrame.ts");
const { DrawingEmbedSource } = await graph.importModule("src/core/editor/embedSource.ts");
after(() => graph.close());

test("frame selection preserves raw paths, clipping, dimensions, titles, padding and escaped table aliases", () => {
  for (const [text, expected] of [
    ["![[../Drawing|Caption|200x100|left]]", "![[../Drawing#^frame=frame-id|Caption|200x100|left]]"],
    ["![[Map#^clippedframe=Part, One,padding=50\\|200\\|right]]", "![[Map#^clippedframe=frame-id,padding=50\\|200\\|right]]"],
    ['![Caption|200](<Map%20one#%5eframe%3dOld> "Keep title")', '![Caption|200](<Map%20one#%5eframe%3dframe-id> "Keep title")'],
    ['![Caption](Map%20one%23%5Eclippedframe%3DOld%2Cpadding%3D00%2E50 "Keep")', '![Caption](Map%20one%23%5Eclippedframe%3Dframe-id%2Cpadding%3D00%2E50 "Keep")'],
  ]) assert.equal(rewriteEmbedFrame(text, "frame-id"), expected);
  assert.equal(rewriteEmbedFrame('![[Map#^frame=Old,padding=50|200]]', null), '![[Map|200]]');
  assert.equal(rewriteEmbedFrame('![[Map#^clippedframe=Old,padding=50|200]]', ''), '![[Map#^frame=|200]]');
  for (const ref of ['../Other', 'frame#evil', 'Name,padding=20']) assert.equal(rewriteEmbedFrame('![[Map]]', ref), null);
});

test("frame selection edits only the owned occurrence and is one undo step", () => {
  const token = '![[Map|200]]', doc = token + '\n' + token;
  let state = EditorState.create({ doc, extensions: [history()] });
  const view = { get state() { return state; }, dispatch(spec) { state = (spec instanceof Transaction ? spec : state.update(spec)).state; } };
  const source = new DrawingEmbedSource(view, token.length + 1, doc.length, token, () => true);
  assert.equal(source.replaceFrame('frame-id'), true);
  assert.equal(state.doc.toString(), token + '\n![[Map#^frame=frame-id|200]]');
  assert.equal(undo(view), true); assert.equal(state.doc.toString(), doc);
  assert.equal(source.replaceFrame('other'), false);
});
