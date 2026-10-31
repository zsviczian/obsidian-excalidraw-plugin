import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const sourcePath = (relativePath) =>
  fileURLToPath(new URL(relativePath, import.meta.url));

function loadRegexLink() {
  const path = sourcePath("../src/shared/ExcalidrawData.ts");
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
  );
  const declaration = source.statements.find(
    (node) =>
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(
        (item) => item.name.getText(source) === "REGEX_LINK",
      ),
  );
  assert.ok(declaration, "REGEX_LINK declaration exists");
  const { outputText } = ts.transpileModule(declaration.getText(source), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} };
  vm.runInNewContext(
    outputText,
    { module, exports: module.exports },
    { filename: path },
  );
  return module.exports.REGEX_LINK;
}

function loadSuggesterLinkMethods() {
  const path = sourcePath("../src/shared/Suggesters/InlineLinkSuggester.ts");
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
  );
  const suggester = source.statements.find(
    (node) =>
      ts.isClassDeclaration(node) && node.name?.text === "InlineLinkSuggester",
  );
  assert.ok(suggester, "InlineLinkSuggester class exists");
  const names = new Set([
    "findActiveLink",
    "findWikiLinkClose",
    "extractActiveInfo",
    "insertLink",
  ]);
  const methods = suggester.members
    .filter(
      (node) =>
        ts.isMethodDeclaration(node) && names.has(node.name.getText(source)),
    )
    .map((node) => node.getText(source));
  assert.ok(methods.some((method) => method.includes("findActiveLink")));
  assert.ok(methods.some((method) => method.includes("insertLink")));
  const { outputText } = ts.transpileModule(
    `class LinkSuggester { ${methods.join("\n")} }\nmodule.exports = LinkSuggester;`,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  );
  const module = { exports: {} };
  vm.runInNewContext(
    outputText,
    { module, exports: module.exports },
    { filename: path },
  );
  return module.exports;
}

function loadHoverMethod(regexLink) {
  const path = sourcePath("../src/view/ExcalidrawView.ts");
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
  );
  const view = source.statements.find(
    (node) =>
      ts.isClassDeclaration(node) && node.name?.text === "ExcalidrawView",
  );
  assert.ok(view, "ExcalidrawView class exists");
  const method = view.members.find(
    (node) =>
      ts.isMethodDeclaration(node) &&
      node.name.getText(source) === "onLinkHover",
  );
  assert.ok(method, "onLinkHover method exists");
  const { outputText } = ts.transpileModule(
    `class LinkHoverView { ${method.getText(source)} }\nmodule.exports = LinkHoverView;`,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  );
  const module = { exports: {} };
  vm.runInNewContext(
    outputText,
    {
      module,
      exports: module.exports,
      REGEX_LINK: regexLink,
      DEVICE: { isIOS: false, isMacOS: false },
    },
    { filename: path },
  );
  return module.exports;
}

const REGEX_LINK = loadRegexLink();
const LinkSuggester = loadSuggesterLinkMethods();
const LinkHoverView = loadHoverMethod(REGEX_LINK);
const filename = "02 \u4e3b\u89d2 [73]";

test("wiki target keeps a single closing bracket, including before alias", () => {
  for (const raw of [
    `[[${filename}]]`,
    `[[${filename}|Alias]]`,
    `![[${filename}]]`,
  ]) {
    const parts = REGEX_LINK.getResList(raw);
    assert.equal(parts.length, 1);
    assert.equal(parts[0].value[0], raw);
    assert.equal(REGEX_LINK.getLink(parts[0]), filename);
  }
  const alias = REGEX_LINK.getResList(`[[${filename}|Alias]]`)[0];
  assert.equal(REGEX_LINK.getAliasOrLink(alias), "Alias");
  assert.equal(
    REGEX_LINK.isTransclusion(REGEX_LINK.getResList(`![[${filename}]]`)[0]),
    true,
  );
});

test("a single closing bracket inside the target is retained", () => {
  const target = "chapter] part";
  const parts = REGEX_LINK.getResList(`[[${target}|Shown]]`);
  assert.equal(parts.length, 1);
  assert.equal(REGEX_LINK.getLink(parts[0]), target);
  assert.equal(REGEX_LINK.getAliasOrLink(parts[0]), "Shown");
});

test("adjacent wiki links and a Markdown link retain separate captures", () => {
  const raw = `[[${filename}]][[next]] [label](dir/a(b).md){42}`;
  const parts = REGEX_LINK.getResList(raw);
  assert.equal(parts.length, 3);
  assert.deepEqual(
    Array.from(parts, (part) => REGEX_LINK.getLink(part)),
    [filename, "next", "dir/a(b).md"],
  );
  assert.equal(REGEX_LINK.getWrapLength(parts[2], 10), 42);
  assert.equal(REGEX_LINK.isWikiLink(parts[2]), false);
});

test("inline suggestions recognize the whole target when editing a completed link", () => {
  const value = `before [[${filename}]] after`;
  const open = value.indexOf("[[");
  const close = value.lastIndexOf("]]");
  const suggester = new LinkSuggester();
  const active = suggester.findActiveLink(value, close);
  assert.equal(active?.open, open);
  assert.equal(active?.close, close);
  const info = suggester.extractActiveInfo(value, close, open, close);
  assert.equal(info.searchTerm, filename);
});

test("replacing an existing completed link consumes all three trailing brackets", () => {
  const value = `before [[${filename}]] after`;
  const open = value.indexOf("[[");
  const close = value.lastIndexOf("]]");
  const suggester = new LinkSuggester();
  suggester.activeOpen = open;
  suggester.activeClose = -1;
  suggester.inputEl = {
    value,
    selectionStart: close,
    setSelectionRange() {},
  };
  suggester.dispatchInputChange = () => {};
  suggester.close = () => {};
  suggester.insertLink(`[[${filename}|Alias]]`);
  assert.equal(suggester.inputEl.value, `before [[${filename}|Alias]] after`);
});

test("hover navigation previews the complete bracketed target", () => {
  const view = new LinkHoverView();
  view.plugin = { settings: { hoverPreviewWithoutCTRL: true } };
  let previewed = null;
  view.showHoverPreview = (link) => {
    previewed = link;
  };
  view.onLinkHover(
    { type: "image", link: `[[${filename}]]` },
    { ctrlKey: false, metaKey: false },
  );
  assert.equal(previewed, filename);
});
