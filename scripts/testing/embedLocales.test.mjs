import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

test("embed controls have complete maintained translations without lossy shell encoding", () => {
  let expected;
  for (const language of ["en", "ru", "es", "zh-cn", "zh-tw"]) {
    const path = new URL(`../../src/lang/locale/${language}.ts`, import.meta.url);
    const source = readFileSync(path, "utf8"), start = source.indexOf("// Drawing embed controls (#3036)"), end = source.indexOf("// Native CLI and agent discovery", start);
    assert.ok(start >= 0 && end > start, language);
    const tree = ts.createSourceFile(path.pathname, source, ts.ScriptTarget.Latest, true), strings = new Map();
    const visit = node => {
      if (ts.isPropertyAssignment(node) && node.getStart(tree) >= start && node.getStart(tree) < end && node.name.text?.startsWith("EMBED_")) {
        assert.ok(ts.isStringLiteral(node.initializer)); strings.set(node.name.text, node.initializer.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
    assert.equal(strings.size, 17, language); expected ??= [...strings.keys()].sort();
    assert.deepEqual([...strings.keys()].sort(), expected, language);
    for (const [key, value] of strings) {
      assert.ok(value.trim()); assert.doesNotMatch(value, /\?|\uFFFD/, language + ": " + key);
      if (language === "ru") assert.match(value, /\p{Script=Cyrillic}/u, key);
      if (language.startsWith("zh-")) assert.match(value, /\p{Script=Han}/u, key);
    }
  }
});

test("frame controls have complete maintained translations", () => {
  let expected;
  for (const language of ["en", "ru", "es", "zh-cn", "zh-tw"]) {
    const path = new URL(`../../src/lang/locale/${language}.ts`, import.meta.url), source = readFileSync(path, "utf8");
    const tree = ts.createSourceFile(path.pathname, source, ts.ScriptTarget.Latest, true), strings = new Map();
    const visit = node => {
      if (ts.isPropertyAssignment(node) && node.getStart(tree) < source.indexOf("// Drawing embed controls (#3036)") && node.name.text?.startsWith("FRAME_")) {
        assert.ok(ts.isStringLiteral(node.initializer)); strings.set(node.name.text, node.initializer.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree); assert.equal(strings.size, 17, language); expected ??= [...strings.keys()].sort();
    assert.deepEqual([...strings.keys()].sort(), expected, language);
    for (const [key, value] of strings) {
      assert.ok(value.trim()); assert.doesNotMatch(value, /\uFFFD/, language + ": " + key);
      if (language === "ru") assert.match(value, /\p{Script=Cyrillic}/u, key);
      if (language.startsWith("zh-")) assert.match(value, /\p{Script=Han}/u, key);
    }
  }
});

test("preview configuration and scope explanations have maintained translations", () => {
  let expected;
  for (const language of ["en", "ru", "es", "zh-cn", "zh-tw"]) {
    const path = new URL(`../../src/lang/locale/${language}.ts`, import.meta.url), source = readFileSync(path, "utf8");
    const tree = ts.createSourceFile(path.pathname, source, ts.ScriptTarget.Latest, true), strings = new Map();
    const visit = node => {
      if (ts.isPropertyAssignment(node) && node.getStart(tree) < source.indexOf("FRAME_NAVIGATE:") && node.name.text?.startsWith("PREVIEW_")) {
        assert.ok(ts.isStringLiteral(node.initializer)); strings.set(node.name.text, node.initializer.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree); assert.equal(strings.size, 16, language); expected ??= [...strings.keys()].sort();
    assert.deepEqual([...strings.keys()].sort(), expected, language);
    for (const [key, value] of strings) {
      assert.ok(value.trim()); assert.doesNotMatch(value, /\uFFFD/, language + ": " + key);
      if (language === "ru") assert.match(value, /\p{Script=Cyrillic}/u, key);
      if (language.startsWith("zh-")) assert.match(value, /\p{Script=Han}/u, key);
    }
    for (const token of ["{drawing}","{count}"]) assert.ok(strings.get("PREVIEW_SHARED_HELP").includes(token));
  }
});
