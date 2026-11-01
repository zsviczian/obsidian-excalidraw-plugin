import assert from "node:assert/strict";
import test from "node:test";
import { closeOwnedPopout } from "./closeOwnedPopout.mjs";

function fixture() {
  const doc = {defaultView: {closed: false}}, view = {containerEl: {ownerDocument: doc, isConnected: true}, excalidrawAPI: {}, isDirty: () => false};
  const windows = [{doc}], leaf = {view, detach() {view.containerEl.isConnected = false;view.excalidrawAPI = null;windows.splice(0);}};
  const workspace = {containerEl: {ownerDocument: {}}, floatingSplit: {children: windows}, iterateAllLeaves: fn => fn(leaf)};
  const previous = globalThis.app;globalThis.app = {workspace};
  return {doc,view,leaf,workspace,restore:()=>{globalThis.app=previous},c:{waitForCleanup:async predicate=>assert.equal(predicate(),true)}};
}
test("a retired popout with stale closed=false is cleaned using editor and workspace evidence", async () => {
  const f=fixture();try {
    const detach=f.leaf.detach;f.leaf.detach=()=>{assert.equal(f.view.containerEl.isConnected,true);detach()};
    await closeOwnedPopout(f.c,f.leaf);await closeOwnedPopout(f.c,f.leaf);
    assert.equal(f.doc.defaultView.closed,false);assert.equal(f.view.excalidrawAPI,null);assert.equal(f.workspace.floatingSplit.children.length,0);
  }finally{f.restore()}
});
test("a closed window flag alone never accepts a still-live editor", async () => {
  const f=fixture();try {f.doc.defaultView.closed=true;f.doc.defaultView.close=()=>{};f.leaf.detach=()=>{};await assert.rejects(closeOwnedPopout(f.c,f.leaf));assert.ok(f.view.excalidrawAPI)}finally{f.restore()}
});
test("shared and main-window leaves are preserved", async () => {
  const f=fixture();try {
    f.workspace.iterateAllLeaves=fn=>{fn(f.leaf);fn({view:{containerEl:{isConnected:true,ownerDocument:f.doc}}})};
    await assert.rejects(closeOwnedPopout(f.c,f.leaf),/shared work/);assert.equal(f.view.containerEl.isConnected,true);
    f.workspace.containerEl.ownerDocument=f.doc;await assert.rejects(closeOwnedPopout(f.c,f.leaf),/main window/);
  }finally{f.restore()}
});
