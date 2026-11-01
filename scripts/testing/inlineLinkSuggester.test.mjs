/** Exercise the real close method with connected/detached dropdowns and nested scopes. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function fixture({ connected, nested = false, deferTimers = false }) {
  const source = readFileSync(resolve(import.meta.dirname, "../../src/shared/Suggesters/InlineLinkSuggester.ts"), "utf8");
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  const timers = [];
  vm.runInNewContext(javascript, {
    exports,
    require: name => name === "./SuggestionModal" ? { SuggestionModal: class {
      onInputChanged() { this.openedCount = (this.openedCount ?? 0) + 1; }
    } } : {},
    window: { setTimeout: callback => deferTimers ? timers.push(callback) : callback() },
  });
  const root = {}, scope = {}, modal = {};
  const stack = nested ? [root, scope, modal] : [root, scope];
  const released = [];
  const instance = Object.create(exports.InlineLinkSuggester.prototype);
  Object.assign(instance, {
    app: { keymap: { popScope(candidate) {
      released.push(candidate);
      const index = stack.indexOf(candidate);
      if (index !== -1) stack.splice(index, 1);
    } } },
    scope,
    suggestEl: { isConnected: connected, detach() { this.isConnected = false; } },
    suggester: { setSuggestions(values) { instance.suggestions = values; } },
    shouldNotOpen: true,
    block: true,
    suggestionGeneration: 0,
  });
  return { instance, scope, root, modal, stack, released, timers };
}

test("closing a detached dropdown releases its keyboard scope", () => {
  const h = fixture({ connected: false });
  h.instance.close();
  assert.deepEqual(h.stack, [h.root]);
  assert.equal(h.released[0], h.scope);
  assert.equal(h.instance.block, false);
});

test("closing an inactive detached scope preserves the modal above it", () => {
  const h = fixture({ connected: false, nested: true });
  h.instance.close();
  assert.deepEqual(h.stack, [h.root, h.modal]);
});

test("connected and repeated closes restore the original scope", () => {
  const h = fixture({ connected: true });
  h.instance.close();
  h.instance.close();
  assert.deepEqual(h.stack, [h.root]);
  assert.equal(h.instance.shouldNotOpen, false);
});

test("an awaited lookup cannot reopen suggestions after closing the input", async () => {
  const h = fixture({ connected: true });
  let finishLookup;
  const lookup = new Promise(resolve => { finishLookup = resolve; });
  Object.assign(h.instance, {
    inputEl: { value: "[[Target#]]", selectionStart: 9, selectionEnd: 9 },
    findActiveLink: () => ({ open: 0, close: 9 }),
    parseLinkContext: () => ({ mode: "heading", file: {}, searchTerm: "", alias: null }),
    loadHeadings: () => lookup,
    modifyInput: value => value,
  });
  h.instance.onInputChanged();
  h.instance.close();
  finishLookup();
  await lookup;
  await Promise.resolve();
  assert.equal(h.instance.openedCount ?? 0, 0);
  assert.equal(h.instance.block, false);
  assert.deepEqual(h.stack, [h.root]);
});

test("a previous close timer does not unblock a newly opened suggestion session", async () => {
  const h = fixture({ connected: true, deferTimers: true });
  Object.assign(h.instance, {
    inputEl: { value: "[[Target#]]", selectionStart: 9, selectionEnd: 9 },
    findActiveLink: () => ({ open: 0, close: 9 }),
    parseLinkContext: () => ({ mode: "heading", file: {}, searchTerm: "", alias: null }),
    loadHeadings: async () => {},
    modifyInput: value => value,
  });
  h.instance.close();
  h.instance.onInputChanged();
  await Promise.resolve();
  assert.equal(h.instance.block, true);
  h.timers.forEach(callback => callback());
  assert.equal(h.instance.block, true);
});
