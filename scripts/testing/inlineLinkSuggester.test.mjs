/** Exercise the real close method with connected/detached dropdowns and nested scopes. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function fixture({ connected, nested = false, deferTimers = false, provider }) {
  const source = readFileSync(resolve(import.meta.dirname, "../../src/shared/Suggesters/InlineLinkSuggester.ts"), "utf8");
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  const timers = [];
  const ownerWindow = { kplexApi: provider, setTimeout: callback => deferTimers ? timers.push(callback) : callback() };
  ownerWindow.Event = class { constructor(type) { this.type = type; } };
  const helpers = new Map();
  function helper(name) {
    if (helpers.has(name)) return helpers.get(name);
    const source = readFileSync(resolve(import.meta.dirname, "../../src/shared/Suggesters", name.slice(2) + ".ts"), "utf8");
    const exports = {};
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
      { exports, window: ownerWindow });
    helpers.set(name, exports);
    return exports;
  }
  vm.runInNewContext(javascript, {
    exports,
    require: name => name === "./SuggestionModal" ? { SuggestionModal: class {
      onInputChanged() { this.openedCount = (this.openedCount ?? 0) + 1; }
    } } : ["./kplexOntologyProvider", "./ontologyLinkCompletion"].includes(name) ? helper(name) : {},
    window: ownerWindow,
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
    limit: 20,
  });
  return { instance, scope, root, modal, stack, released, timers, ownerWindow, helper };
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

test("configured public ontology completion uses the existing inline popup owner", () => {
  const revision = { semantic: 1, source: 1, configuration: 1 };
  const provider = { version: 1, v1: { version: 1,
    capabilities: () => ({ ok: true, value: { version: 1, operations: ["completeOntology"] } }),
    completeOntology: () => ({ ok: true, revision, value: { state: "matched", context: {
      range: { start: 0, end: 3 }, query: "", role: "all", trigger: ":::", prefix: "",
    }, items: [{ name: "friend", role: "left", roles: ["left"] }], truncated: false } }),
  } };
  const h = fixture({ connected: false, provider });
  h.instance.inputEl = { value: ":::", selectionStart: 3, selectionEnd: 3, ownerDocument: { defaultView: h.ownerWindow } };
  h.instance.onInputChanged();
  assert.equal(h.instance.mode, "ontology");
  assert.equal(h.instance.getSuggestions()[0].item.name, "friend");
  assert.equal(h.instance.openedCount, 1);
});

/** Supply public detached data, not a second trigger matcher, to the real input owner. */
function ontologyFixture(marked, name = "friend", trigger = ":::") {
  const cursor = marked.indexOf("|"), text = marked.replace("|", ""), start = text.indexOf(trigger);
  assert(cursor >= 0 && start >= 0);
  const revision = { semantic: 1, source: 1, configuration: 1 };
  const result = { ok: true, revision, value: { state: "matched", context: {
    range: { start, end: cursor }, query: text.slice(start + trigger.length, cursor), trigger, role: "all", prefix: "",
  }, items: [{ name, role: "left", roles: ["left"], partner: "Partner", description: "<b>Literal description</b>" }], truncated: false } };
  let calls = 0;
  const provider = { version: 1, v1: { version: 1,
    capabilities: () => ({ ok: true, value: { operations: ["completeOntology"] } }),
    completeOntology: request => { calls++; return request.text === text && request.cursor === cursor ? result :
      { ok: true, revision, value: { state: "no-match", context: null, items: [], truncated: false } }; },
  } };
  const h = fixture({ connected: false, provider });
  const doc = { defaultView: h.ownerWindow, activeElement: null };
  const events = [];
  const input = { value: text, selectionStart: cursor, selectionEnd: cursor, isConnected: true, ownerDocument: doc,
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
    focus() { doc.activeElement = this; },
    dispatchEvent(event) { events.push(event.type); if (event.type === "input") h.instance.onInputChanged(); return true; },
  };
  h.instance.inputEl = input;
  h.instance.app.metadataCache = { getFirstLinkpathDest: () => null };
  h.instance.getSourcePath = () => "Drawing.excalidraw.md";
  h.instance.ensureLinkItemsLoaded = () => { h.instance.linkItemsLoaded = true; };
  return { ...h, input, doc, result, provider, events, calls: () => calls,
    marked: () => input.value.slice(0, input.selectionStart) + "|" + input.value.slice(input.selectionEnd),
    offer() { h.instance.onInputChanged(); return h.instance.getSuggestions()[0]?.item; },
  };
}

test("ontology insertion preserves exact names, wrappers, closers, suffixes and caret", () => {
  for (const [input, field, trigger, expected] of [
    [":::|", "friend", ":::", "friend::|"],
    ["::p|", "parent", "::p", "parent::|"],
    ["(:::|", "parent", ":::", "(parent:: |)"],
    ["(::pPar|)", "Parent", "::p", "(Parent:: |)"],
    ["[:::|", "friend", ":::", "[friend:: |]"],
    ["[:::|]", "friend", ":::", "[friend:: |]"],
    ["Before (:::|) after", "Parent With Space", ":::", "Before (Parent With Space:: |) after"],
    ["Before (:::| trailing)", "PaRéNT", ":::", "Before (PaRéNT:: | trailing)"],
    ["(:::| unrelated", "Parent", ":::", "(Parent:: |) unrelated"],
    ["[:::| (unrelated)] suffix", "Friend", ":::", "[Friend:: | (unrelated)] suffix"],
  ]) {
    const h = ontologyFixture(input, field, trigger), item = h.offer();
    h.instance.onChooseItem(item);
    assert.equal(h.marked(), expected, input);
    assert.equal(h.doc.activeElement, h.input);
    assert.deepEqual(h.events, ["input", "change"]);
    assert.deepEqual(h.stack, [h.root]);
  }
});

test("ontology completion continues into the existing wikilink mode and bracket-containing names", () => {
  for (const wrapper of ["(", "["]) {
    const h = ontologyFixture(wrapper + ":::|", "Parent"), item = h.offer();
    h.instance.onChooseItem(item);
    for (let count = 0; count < 2; count++) h.instance.onBracketKeyDown({ key: "[", preventDefault() {} });
    assert.equal(h.instance.mode, "file");
    h.instance.onChooseItem({ path: "Note [draft]" });
    assert.equal(h.input.value, wrapper + "Parent:: [[Note [draft]]]" + (wrapper === "(" ? ")" : "]"));
    assert.equal(h.input.selectionStart, h.input.value.length - 1);
  }
});

test("a bracket in a queried filename cannot consume the square ontology wrapper", () => {
  for (const [text, expected] of [
    ["[Parent:: [[Note [draft]|]", "[Parent:: [[Note [draft]]]]"],
    ["[Parent:: [[Note [draft]|]]] suffix", "[Parent:: [[Note [draft]]]] suffix"],
    ["(Parent:: [[Note [draft]|]]) suffix", "(Parent:: [[Note [draft]]]) suffix"],
  ]) {
    const h = ontologyFixture(":::|"), cursor = text.indexOf("|"), value = text.replace("|", "");
    h.input.value = value; h.input.setSelectionRange(cursor,cursor);
    const active = h.instance.findActiveLink(value, cursor);
    assert(active, text);
    h.instance.activeOpen = active.open; h.instance.activeClose = active.close;
    h.instance.insertLink("[[Note [draft]]]");
    assert.equal(h.input.value, expected);
  }
});

test("wrapped bracket filenames retain real alias, heading, block, frame and clipped-frame parsing", () => {
  const h=ontologyFixture(":::|"),note={basename:"Note [draft]",path:"Note [draft].md",extension:"md"},drawing={basename:"Drawing [draft]",path:"Drawing [draft].excalidraw.md",extension:"md"};
  h.instance.getSourcePath=()=>"Source.md";
  h.instance.app.metadataCache={getFirstLinkpathDest:path=>path===note.basename?note:path===drawing.basename?drawing:null};
  h.instance.plugin={isExcalidrawFile:file=>file===drawing};
  for(const [marked,mode,searchTerm,inAlias]of [
    ["[Parent:: [[Note [draft]§]]]","file","Note [draft]",false],
    ["[Parent:: [[Note [draft]|alias§]]]","file","Note [draft]",true],
    ["(Parent:: [[Note [draft]#Heading§]])","heading","Heading",false],
    ["[Parent:: [[Note [draft]#^block-id§]]]","block","block-id",false],
    ["[Parent:: [[Drawing [draft]#^frame=Frame§]]]","frame","Frame",false],
    ["(Parent:: [[Drawing [draft]#^clippedframe=Frame§]])","clippedframe","Frame",false],
  ]){
    const cursor=marked.indexOf("§"),value=marked.replace("§",""),active=h.instance.findActiveLink(value,cursor);assert(active,marked);
    const context=h.instance.parseLinkContext(value,cursor,active.open,active.close);
    assert.equal(context.mode,mode,marked);assert.equal(context.searchTerm,searchTerm,marked);assert.equal(context.inAlias,inAlias,marked);
  }
});

test("provider/configuration/input changes retire captured ontology rows without mutation", () => {
  for (const change of [
    h => { h.result.revision.configuration++; },
    h => { h.ownerWindow.kplexApi = { ...h.provider }; },
    h => { h.result.value.state = "disabled"; },
    h => { delete h.ownerWindow.kplexApi; },
    h => { h.provider.v1.completeOntology = () => { throw Error("retired"); }; },
    h => { h.provider.v1.capabilities = () => ({ ok: true, value: { operations: [] } }); },
    h => { h.input.value += "changed"; },
    h => { h.input.selectionStart--; },
  ]) {
    const h = ontologyFixture("(:::|)", "Parent"), item = h.offer();
    change(h); const before = h.input.value;
    h.instance.onChooseItem(item);
    assert.equal(h.input.value, before);
    assert.deepEqual(h.events, []);
    assert.deepEqual(h.stack, [h.root]);
  }
  const h = ontologyFixture(":::|", "Friend"), item = h.offer();
  h.result.revision.semantic++; h.result.revision.source++;
  h.instance.onChooseItem(item);
  assert.equal(h.input.value, "Friend::", "Unrelated graph publication cannot stale configuration-only completion");
});

test("missing or incompatible providers leave normal editing and existing suggestion precedence intact", () => {
  const h = ontologyFixture(":::|");
  for (const provider of [undefined, {}, { version: 9, v1: h.provider.v1 }, { version: 1, v1: {} }]) {
    h.ownerWindow.kplexApi = provider; h.instance.onInputChanged();
    assert.equal(h.instance.mode, null); assert.equal(h.instance.block, false);
  }
  h.ownerWindow.kplexApi = h.provider;
  for (const value of ["[[Note]]", "[[Note#Heading]]", "[[Note#^block]]", "[[Note#^frame=Frame]]", "[[Note#^clippedframe=Frame]]", "[[Note|Alias]]"]) {
    const before = h.calls(); h.input.value = value; h.input.setSelectionRange(value.length - 2, value.length - 2);
    h.instance.parseLinkContext = () => ({ mode: "file", file: null, searchTerm: "", alias: null });
    h.instance.onInputChanged(); assert.equal(h.calls(), before);
  }
  h.input.value = "#tag"; h.input.setSelectionRange(4, 4); h.instance.getTagSuggestions = () => [];
  const before = h.calls(); h.instance.onInputChanged(); assert.equal(h.instance.mode, "tag"); assert.equal(h.calls(), before);
});

test("composition and selections do not call the provider or submit link-editor Enter", () => {
  const h = ontologyFixture(":::|"), before = h.calls();
  h.instance.composing = true; h.instance.onInputChanged(); assert.equal(h.calls(), before);
  let stopped = false, prevented = false;
  h.instance.onBracketKeyDown({ key: "Enter", isComposing: true, stopPropagation() { stopped = true; }, preventDefault() { prevented = true; } });
  assert(stopped); assert.equal(prevented, false);
  h.instance.composing = false; h.input.selectionStart = 0; h.instance.onInputChanged(); assert.equal(h.calls(), before);
});

test("ontology annotations render as inert text and two inputs cannot choose each other's rows", () => {
  const first = ontologyFixture(":::|", "Friend"), second = ontologyFixture(":::|", "Friend"), item = first.offer(); second.offer();
  second.instance.onChooseItem(item); assert.equal(second.input.value, ":::"); assert.equal(first.instance.block, true);
  const rendered = [];
  first.instance.renderSuggestion({ item }, { addClass() {}, createDiv(value) { rendered.push(value.text); } });
  assert.deepEqual(rendered, ["Friend", "↔ Partner", "<b>Literal description</b>"]);
  first.instance.onChooseItem(item); assert.equal(first.input.value, "Friend::");
});
