/** Executes production EA/path/creation-form behavior with bounded Vault and native-control boundaries. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";
const compile = source => ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
function members(path, names) {
  const tree = ts.createSourceFile(path, readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
  const found = [];
  function visit(node) {
    if ((ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node)) && names.includes(node.name.getText(tree))) found.push(node.getText(tree));
    ts.forEachChild(node, visit);
  }
  visit(tree); return found.join("\n");
}
function subject(source, dependencies = {}) {
  const module = {exports: {}};
  vm.runInNewContext(compile(source), {module, exports: module.exports, ...dependencies});
  return module.exports;
}
const normalizePath = path => path.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
const {newFileDestination} = subject(readFileSync(new URL("../../src/shared/Dialogs/newFileDestination.ts", import.meta.url), "utf8"), {require: () => ({normalizePath})});

test("drawing destination follows live compatibility/extension preferences and exposes the live template setting", () => {
  const {EA} = subject(`export class EA {${members("src/shared/ExcalidrawAutomate.ts", ["templateFilePath", "getDrawingFilePath"])}}`, {normalizePath});
  const ea = new EA(); ea.plugin = {settings: {templateFilePath: "Templates", compatibilityMode: false, useExcalidrawExtension: true}};
  assert.equal(ea.templateFilePath, "Templates"); assert.equal(ea.getDrawingFilePath("New", "Folder"), "Folder/New.excalidraw.md");
  ea.plugin.settings.useExcalidrawExtension = false;
  assert.equal(ea.getDrawingFilePath("New"), "New.md");
  ea.plugin.settings.compatibilityMode = true;
  assert.equal(ea.getDrawingFilePath("New", "Folder"), "Folder/New.excalidraw");
  ea.plugin.settings.templateFilePath = "Other.md"; assert.equal(ea.templateFilePath, "Other.md");
  for (const name of ["", " ", "../New", "Folder/New", "Folder\\New"]) assert.throws(() => ea.getDrawingFilePath(name));
});

test("new-file destination rejects traversal and invalid filenames before normalization", () => {
  assert.equal(newFileDestination("Folder/Child", "New"), "Folder/Child/New.md");
  assert.equal(newFileDestination("/", "New.md"), "New.md");
  for (const [folder, name] of [["../Folder", "New"], ["Folder/../Else", "New"], ["Folder", "../New"], ["", ""], ["", "a:b"], ["", "a\u0000b"]]) assert.equal(newFileDestination(folder, name), null);
});

function form() {
  const buttons = new Map(), inputs = new Map(), files = new Map(), calls = [], notices = [];
  const controls = [], settings = [], suggestOptions = [];
  function element() { return {setText() {}, createDiv(options, callback) {const el = element(); callback?.(el); return el;},
    createEl(tag, options) {const el = element(); if (tag === "button") {buttons.set(options.text, el); controls.push(el);} return el;},
    querySelectorAll: () => controls, addClass() {}}; }
  class Setting {
    constructor() {this.controlEl = element(); settings.push(this);}
    setClass(value) {this.className = value; return this;}
    setName(value) {this.name = value; return this;}
    addText(configure) {const text = {inputEl: {}, setValue(value) {this.value = value; return this;}, onChange(callback) {this.change = callback; return this;}}; configure(text); inputs.set(this.name, text); return this;}
  }
  const {Form} = subject(`export class Form {${members("src/shared/Dialogs/Prompt.ts", ["createForm", "retargetSource"])}}`, {
    Setting, VaultPathSuggest: class {constructor(...args) {suggestOptions.push(args[4]);} close() {}}, setStyle() {}, t: key => key, newFileDestination, errorlog: error => {calls.push(error);},
    Notice: class {constructor(message) {notices.push(message);}}, checkAndCreateFolder: async folder => calls.push(["folder", folder]), sleep: async () => {},
  });
  const modal = new Form();
  Object.assign(modal, {titleEl: element(), contentEl: element(), closed: false, path: "Old/Missing", parentFile: {path: "Origin.md"},
    app: {vault: {create: async (path, data) => {if (files.has(path)) throw Error("collision"); const file = {path, data}; files.set(path, file); return file;}}},
    plugin: {prepareDrawing: async () => ({kind: "ready", data: "drawing"})}, close() {this.closed = true;}, openFile(file) {calls.push(["open", file.path]);}});
  modal.createForm();
  return {modal, buttons, inputs, files, calls, notices, settings, suggestOptions};
}

test("new-file form applies editable folder/name, creates missing folders and refuses to overwrite a collision", async () => {
  const state = form(); state.inputs.get("FILE_AND_FOLDER_SELECTOR_FOLDER").change("Chosen/Child");
  state.inputs.get("FILE_AND_FOLDER_SELECTOR_FILENAME").change("Selected.md");
  await state.buttons.get("PROMPT_BUTTON_CREATE_MARKDOWN").onclick();
  assert(state.files.has("Chosen/Child/Selected.md")); assert.equal(state.files.get("Chosen/Child/Selected.md").data, "");
  assert.deepEqual(state.calls[0], ["folder", "Chosen/Child"]);
  const collision = form(); collision.files.set("Old/Missing.md", {data: "keep"});
  await collision.buttons.get("PROMPT_BUTTON_CREATE_MARKDOWN").onclick();
  assert.equal(collision.files.get("Old/Missing.md").data, "keep"); assert.equal(collision.modal.closed, false);
  assert.deepEqual(collision.notices, ["ERROR_TRY_AGAIN"]);
});

test("template cancellation and invalid destinations leave the new-file form open without file writes", async () => {
  const state = form(); state.modal.plugin.prepareDrawing = async () => ({kind: "cancel"});
  await state.buttons.get("PROMPT_BUTTON_CREATE_EXCALIDRAW").onclick();
  assert.equal(state.files.size, 0); assert.equal(state.calls.length, 0); assert.equal(state.modal.closed, false);
  state.inputs.get("FILE_AND_FOLDER_SELECTOR_FOLDER").change("../Elsewhere");
  await state.buttons.get("PROMPT_BUTTON_CREATE_MARKDOWN").onclick();
  assert.equal(state.files.size, 0); assert.deepEqual(state.notices, ["PROMPT_ERROR_INVALID_FILE_PATH"]);
});

test("template folder scanning includes descendants and excludes similarly prefixed sibling folders", async () => {
  const {execFileSync} = await import("node:child_process");
  const path = "src/utils/fileUtils.ts";
  const source = process.env.EXCALIDRAW_TEMPLATE_SCAN_BASELINE === "1"
    ? execFileSync("git", ["show", `HEAD:${path}`], {encoding: "utf8"})
    : readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  let expression;
  function visit(node) {if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "getListOfTemplateFiles") expression = node.initializer.getText(tree); ts.forEachChild(node, visit);}
  visit(tree);
  class Folder {constructor(path) {this.path = path;}}
  class File {constructor(path) {this.path = path;}}
  let folder = new Folder("Templates");
  const files = [new File("Templates/A.md"), new File("Templates/Sub/B.md"), new File("Templates-extra/Other.md")];
  const {list} = subject(`export const list = ${expression};`, {normalizePath, TFolder: Folder, TFile: File});
  const plugin = {settings: {templateFilePath: "Templates"}, app: {vault: {getAbstractFileByPath: () => folder, getFiles: () => files}}, isExcalidrawFile: () => true};
  assert.deepEqual(Array.from(list(plugin), file => file.path), ["Templates/A.md", "Templates/Sub/B.md"]);
  folder = new Folder("/"); plugin.settings.templateFilePath = "/";
  assert.equal(list(plugin).length, 3);
  plugin.settings.templateFilePath = " ";
  assert.equal(list(plugin), null, "unconfigured templates must not scan the vault root");
});

function variable(path, name) {
  const tree = ts.createSourceFile(path, readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
  let expression;
  function visit(node) {if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) expression = node.initializer.getText(tree); ts.forEachChild(node, visit);}
  visit(tree); assert(expression, name); return expression;
}

test("relocated creation updates only the clicked link, preserving aliases and other links, and retires its workbench", async () => {
  const {REGEX_LINK} = subject(`export const REGEX_LINK = ${variable("src/shared/ExcalidrawData.ts", "REGEX_LINK")};`);
  const {getLink} = subject(`export const getLink = ${variable("src/utils/fileUtils.ts", "getLink")};`);
  const source = {id: "source", version: 1, type: "text", rawText: "See [[Old/Missing|Display title]] and [[Other]]", text: "Display title", link: null};
  let copied = [], destroyed = 0, published;
  const ea = {getBoundTextElement: () => ({}), copyViewElementsToEAforEditing: items => {copied = items.map(item => ({...item}));},
    getElements: () => copied, destroy: () => destroyed++};
  const {Form} = subject(`export class Form {${members("src/shared/Dialogs/Prompt.ts", ["retargetSource"])}}`, {REGEX_LINK, getLink, getEA: () => ea});
  const modal = new Form();
  const view = {file: {path: "Origin.md"}, excalidrawAPI: {getSceneElements: () => [source]}, isClosingOrMigrating: () => false,
    addElements: async options => {options.validateBeforePublish(); published = options.newElements;}};
  Object.assign(modal, {closed: false, path: "Old/Missing", sourceElement: source, view, plugin: {settings: {embedWikiLink: true}},
    app: {metadataCache: {getFirstLinkpathDest: () => null}, vault: {getFileByPath: () => view.file}}});
  await modal.retargetSource({path: "Chosen/New.md"});
  assert.equal(published[0].id, "source");
  assert.equal(published[0].rawText, "See [[Chosen/New.md|Display title]] and [[Other]]");
  assert.equal(source.rawText, "See [[Old/Missing|Display title]] and [[Other]]", "only mutable workbench copies are edited");
  assert.equal(destroyed, 1);
  view.addElements = async options => {view.isClosingOrMigrating = () => true; options.validateBeforePublish();};
  await assert.rejects(modal.retargetSource({path: "Another.md"}), /retired/);
  assert.equal(destroyed, 2);
  view.isClosingOrMigrating = () => false;
  modal.app.vault.getFileByPath = () => null;
  await assert.rejects(modal.retargetSource({path: "Replacement.md"}), /retired/);
  assert.equal(destroyed, 3);
});


test("new-file modal uses full-row fields and enables folder suggestions only after input", () => {
  const state = form();
  assert(state.settings.slice(0, 2).every(setting => setting.className === "excalidraw-file-and-folder-selector__field"));
  assert.equal(state.suggestOptions[0].openOnFocus, false);
  const source = readFileSync(new URL("../../src/shared/Dialogs/Prompt.ts", import.meta.url), "utf8");
  assert.match(source, /class NewFileActions extends Modal/);
});

/** Run the real suggester's focus/input gate with the native superclass listener ordering. */
test("folder completion stays closed on focus, opens on first typing, and releases its input gates", () => {
  // Node EventTarget does not implement DOM capture ordering. This input boundary
  // delivers capture listeners before native bubble listeners, as a real input does.
  class Input {
    value = "Default";
    listeners = [];
    addEventListener(type, run, capture = false) {this.listeners.push({type, run, capture});}
    removeEventListener(type, run, capture = false) {this.listeners = this.listeners.filter(item => item.type !== type || item.run !== run || item.capture !== capture);}
    dispatchEvent(event) {for (const capture of [true, false]) for (const item of [...this.listeners]) if (item.type === event.type && item.capture === capture) item.run(event);}
  }
  class Folder {constructor() {this.path = this.name = "Default";}}
  class NativeSuggest {
    constructor(_app, input) {this.opened = 0; this.closed = 0; input.addEventListener("focus", () => this.open()); input.addEventListener("input", () => this.open());}
    open() {this.opened++;}
    close() {this.closed++;}
  }
  const input = new Input(), app = {vault: {getAllLoadedFiles: () => [new Folder()]}};
  const module = subject(readFileSync(new URL("../../src/shared/Suggesters/VaultPathSuggest.ts", import.meta.url), "utf8"), {
    require: () => ({AbstractInputSuggest: NativeSuggest, TFolder: Folder, TFile: class {}}),
  });
  const suggest = new module.VaultPathSuggest(app, input, "folder", undefined, {openOnFocus: false});
  input.dispatchEvent(new Event("focus")); assert.equal(suggest.opened, 0);
  input.value = "Def"; input.dispatchEvent(new Event("input")); assert.equal(suggest.opened, 1);
  assert.equal(suggest.getSuggestions("Def")[0].path, "Default");
  input.dispatchEvent(new Event("blur")); input.dispatchEvent(new Event("focus")); assert.equal(suggest.opened, 1);
  suggest.destroy(); input.dispatchEvent(new Event("input")); assert.equal(suggest.opened, 1);
  const legacyInput = new Input(), legacy = new module.VaultPathSuggest(app, legacyInput, "folder");
  legacyInput.dispatchEvent(new Event("focus")); assert.equal(legacy.opened, 1, "Other path inputs retain focus completion");
});
