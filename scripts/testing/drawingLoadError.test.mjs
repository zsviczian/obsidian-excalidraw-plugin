/** Exercise real confirmation buttons and file-specific, read-only error UI without Obsidian. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = resolve(import.meta.dirname, "../..");
const read = path => readFileSync(resolve(root, path), "utf8");
function locale(language) {
  const entries = {};
  const visit = node => {
    if (ts.isPropertyAssignment(node) && node.name.text?.startsWith("DRAWING_LOAD_ERROR_")) {
      assert.ok(ts.isStringLiteral(node.initializer));
      entries[node.name.text] = node.initializer.text;
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile("locale.ts", read(`src/lang/locale/${language}.ts`), ts.ScriptTarget.Latest, true));
  return entries;
}

function fixture() {
  const strings = { ...locale("en"), PROMPT_TITLE_CONFIRMATION: "Confirmation",
    PROMPT_BUTTON_CANCEL: "Cancel", PROMPT_BUTTON_OK: "OK", PROMPT_BUTTON_CLOSE: "Close" };
  const t = key => { assert.ok(key in strings, key); return strings[key]; };
  class Element {
    constructor(tag = "div", options = {}) { this.tag = tag; this.textContent = options.text ?? ""; this.children = []; }
    createEl(tag, options) { const child = new Element(tag, options); this.children.push(child); return child; }
    createDiv(options) { return this.createEl("div", options); }
    setText(text) { this.textContent = text; }
    addClass() {}
    empty() { this.children = []; }
    focus() { this.focused = true; }
    querySelector(tag) { return this.all().find(el => el.tag === tag) ?? null; }
    all() { return this.children.flatMap(child => [child, ...child.all()]); }
    button(text) { return this.all().find(el => el.tag === "button" && el.textContent === text); }
  }
  const opened = [], notices = [];
  class Modal {
    constructor(app) { this.app = app; this.contentEl = new Element(); this.titleEl = new Element("h2"); }
    open() { opened.push(this); this.onOpen(); }
    close() { this.onClose(); }
    onOpen() {}
    onClose() {}
  }
  class ButtonComponent {
    constructor(el) { this.buttonEl = el.createEl("button"); }
    setButtonText(text) { this.buttonEl.setText(text); return this; }
    onClick(callback) { this.buttonEl.click = callback; return this; }
    setCta() { return this; }
  }
  const promptSource = read("src/shared/Dialogs/Prompt.ts");
  const prompt = promptSource.slice(promptSource.indexOf("export class MultiOptionConfirmationPrompt"),
    promptSource.indexOf("export async function linkPrompt"));
  const load = (source, dependencies, globals = {}) => {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText, { exports, ...dependencies, ...globals });
    return exports;
  };
  const { MultiOptionConfirmationPrompt } = load(prompt, { Modal, ButtonComponent, t,
    setStyle() {}, setSanitizedHtml(el, text) { el.textContent = text; },
    window: { setTimeout: callback => callback() } });
  const obsidian = { Modal, ButtonComponent, Notice: class {
    constructor(content, duration) { notices.push({ content, duration }); }
  } };
  const ui = load(read("src/shared/Dialogs/DrawingLoadErrorInfo.ts"), {}, {
    require(name) {
      if (name === "obsidian") return obsidian;
      if (name === "./Prompt") return { MultiOptionConfirmationPrompt };
      if (name === "src/lang/helpers") return { t };
      throw Error(`Unexpected dependency: ${name}`);
    },
    createFragment: () => new Element("fragment"),
  });
  const app = { vault: new Proxy({}, { get() { throw Error("Error UI must not access the vault"); } }) };
  return { ui, app, opened, notices };
}

test("More information preserves the confirmation promise and original OK/Cancel behavior", async () => {
  const h = fixture();
  for (const [button, expected] of [["Cancel", null], ["OK", true]]) {
    const prompt = h.ui.createDrawingLoadErrorPrompt({ app: h.app }, { name: "Daily.md", path: "Notes/Daily.md" }, "Wait", Error("Missing drawing"));
    assert.equal(prompt.contentEl.button("Cancel").focused, true);
    let settled = false;
    prompt.waitForClose.then(() => { settled = true; });
    prompt.contentEl.button("More information").click();
    const info = h.opened.at(-1);
    assert.equal(info.contentEl.children[0].textContent, "Notes/Daily.md");
    info.contentEl.button("Close").click();
    await Promise.resolve();
    assert.equal(settled, false);
    prompt.contentEl.button(button).click();
    assert.equal(await prompt.waitForClose, expected);
  }
});

test("concurrent warnings retain their file snapshot and render untrusted error text safely", () => {
  const h = fixture();
  const first = { name: "$& <img>.md", path: "Daily/$& <img>.md" };
  const prompt = h.ui.createDrawingLoadErrorPrompt({ app: h.app }, first, "Backup", { message: "<img src=x onerror=alert(1)>" });
  h.ui.createDrawingLoadErrorPrompt({ app: h.app }, { name: "Other.md", path: "Other.md" }, "Backup", null);
  first.name = "Renamed.md"; first.path = "Renamed.md";
  assert.equal(prompt.titleEl.textContent, "Cannot load drawing: $& <img>.md");
  prompt.contentEl.button("More information").click();
  const info = h.opened.at(-1);
  assert.equal(info.contentEl.children[0].textContent, "Daily/$& <img>.md");
  assert.equal(info.contentEl.querySelector("code").textContent, "<img src=x onerror=alert(1)>");
  assert.equal(info.contentEl.querySelector("img"), null);
});

test("no-backup notices stay non-blocking and long Unicode names retain their extension", () => {
  const h = fixture();
  const name = "😀".repeat(100) + ".excalidraw.md";
  h.ui.showDrawingLoadErrorNotice(h.app, { name, path: `Notes/${name}` }, "Invalid JSON");
  assert.equal(h.opened.length, 0);
  const notice = h.notices[0];
  assert.equal(notice.duration, 10000);
  const title = notice.content.children[0].textContent;
  assert.equal(Array.from(title.replace("Cannot load drawing: ", "")).length, 80);
  assert.ok(title.endsWith(".excalidraw.md"));
  assert.ok(!title.includes("�"));
  notice.content.button("More information").click();
  assert.equal(h.opened.at(-1).contentEl.children[0].textContent, `Notes/${name}`);
});

test("all maintained locales include every new error key and the filename placeholder", () => {
  const keys = Object.keys(locale("en")).sort();
  for (const language of ["ru", "es", "zh-cn", "zh-tw"]) {
    const strings = locale(language);
    assert.deepEqual(Object.keys(strings).sort(), keys);
    assert.ok(strings.DRAWING_LOAD_ERROR_TITLE.includes("{filename}"));
  }
});
