/** Execute actual factory methods with a deterministic Obsidian focus boundary.
 * AST isolation receives no whole-module coverage or native-rendering credit.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function factory({ originalFocus = false } = {}) {
  const source = readFileSync(
    new URL("../../src/view/managers/CanvasNodeFactory.ts", import.meta.url),
    "utf8",
  );
  const tree = ts.createSourceFile(
      "CanvasNodeFactory.ts",
      source,
      ts.ScriptTarget.Latest,
      true,
    ),
    methods = [];
  const visit = (node) => {
    if (
      ts.isMethodDeclaration(node) &&
      ["createFileNote", "startEditing"].includes(node.name.getText(tree))
    )
      methods.push(node.getText(tree));
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.equal(methods.length, 2);
  let code = methods.join("\n");
  if (originalFocus) code = code.replace(/\s*focus: false,/, "");
  const exports = {},
    errors = [];
  vm.runInNewContext(
    ts.transpileModule("export class Subject{" + code + "}", {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      isObsidianThemeDark: () => false,
      console: { error: (...args) => errors.push(args) },
    },
  );
  const previous = { editor: { hasFocus: () => true } },
    state = {
      activeEditor: previous,
      previous,
      removed: [],
      appended: [],
      editRequests: [],
      errors,
      blockersRemoved: 0,
    };
  const subject = Object.assign(new exports.Subject(), {
    initialized: true,
    nodes: new Map(),
    pendingEditRequests: new WeakMap(),
    view: {
      async setEmbeddableNodeIsEditing(id) {
        state.editRequests.push(id);
      },
    },
    canvas: {
      createFileNode(options) {
        const node = {
          options,
          child: { file: options.file },
          isEditable: () => true,
          setFilePath(path, subpath) {
            this.path = path;
            this.subpath = subpath;
          },
          render() {
            this.rendered = true;
          },
          containerEl: {
            querySelector: () => ({
              remove() {
                state.blockersRemoved++;
              },
            }),
          },
          startEditing() {
            this.child.editor = { hasFocus: () => true };
            state.activeEditor = this.child;
          },
        };
        // Obsidian's real createFileNode defaults omitted focus to selectOnly(node).
        if (options.focus !== false) state.activeEditor = node.child;
        return node;
      },
      removeNode(node) {
        state.removed.push(node);
      },
    },
  });
  state.subject = subject;
  state.file = { path: "Notes/Owned.md" };
  state.container = {
    appendChild(node) {
      state.appended.push(node);
    },
  };
  return state;
}

test("internal preview construction preserves the active editor and renders the requested file", () => {
  const s = factory(),
    node = s.subject.createFileNote(s.file, "#Heading", s.container, "owned");
  assert.equal(s.activeEditor, s.previous);
  assert.equal(s.activeEditor.editor.hasFocus(), true);
  assert.equal(node.path, s.file.path);
  assert.equal(node.subpath, "#Heading");
  assert.equal(node.rendered, true);
  assert.equal(s.subject.nodes.get("owned"), node);
  assert.deepEqual(s.appended, [node.containerEl]);
  assert.equal(s.blockersRemoved, 1);
});

test("replacing an internal preview preserves focus and replaces only its registered node", () => {
  const s = factory(),
    first = s.subject.createFileNote(s.file, null, s.container, "owned");
  const second = s.subject.createFileNote(
    s.file,
    "#Next",
    s.container,
    "owned",
  );
  assert.equal(first.subpath, "");
  assert.deepEqual(s.removed, [first]);
  assert.equal(s.subject.nodes.get("owned"), second);
  assert.equal(s.activeEditor, s.previous);
});

test("explicit embedded-note editing still enters the editor and acquires focus", async () => {
  const s = factory(),
    node = s.subject.createFileNote(s.file, "", s.container, "owned");
  assert.equal(s.activeEditor, s.previous);
  await s.subject.startEditing(node, "theme-light", true, "owned");
  assert.equal(node.isEditing, true);
  assert.equal(s.activeEditor, node.child);
  assert.equal(s.activeEditor.editor.hasFocus(), true);
  assert.deepEqual(s.editRequests, ["owned"]);
  assert.deepEqual(s.errors, []);
});

test("the old default-focus path reproduces the missing-editor toolbar failure", () => {
  const s = factory({ originalFocus: true });
  s.subject.createFileNote(s.file, "", s.container, "owned");
  assert.notEqual(s.activeEditor, s.previous);
  assert.throws(() => s.activeEditor.editor.hasFocus(), /hasFocus/);
});
