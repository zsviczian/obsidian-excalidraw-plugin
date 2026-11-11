import assert from "node:assert/strict";
import test, { after } from "node:test";
import { load } from "js-yaml";
import { sourceHarness } from "./sourceHarness.mjs";
const graph = sourceHarness({ obsidian: { parseYaml: load } });
const { getFrameAnchors, resolveThumbnailFrame, syncFrameAnchors, writeFrameProperty, readFrameProperty } = await graph.importModule("src/utils/frameMetadata.ts");
after(() => graph.close());
const frame = (id, name, frameRole) => ({ id, name, type: "frame", x: 10, y: 20, width: 200, height: 100, frameRole });

test("frame anchors include actual regular and marker names, preserving order and punctuation", () => {
  const scene = [frame("a", null), frame("b", "  "), frame("c", "Frame"), frame("d", "中心, padding=20", "marker"), frame("e", "Frame"), { ...frame("f", "Deleted"), isDeleted: true }];
  assert.deepEqual(getFrameAnchors(scene), ["Frame", "中心, padding=20"]);
  const source = '---\ncustom: "keep"\nnested:\n  value: yes\n---\nBody\n';
  const result = syncFrameAnchors(source, scene);
  assert.deepEqual(readFrameProperty(result, "excalidraw-anchors"), ["Frame", "中心, padding=20"]);
  assert.ok(result.includes('custom: "keep"\nnested:\n  value: yes\n')); assert.ok(result.endsWith("---\nBody\n"));
  assert.equal(syncFrameAnchors(result, scene), result);
  assert.ok(syncFrameAnchors(source, scene, false).indexOf("excalidraw-anchors:") > source.indexOf("nested:"));
});

test("frame metadata replaces only its own multiline property and leaves invalid YAML untouched", () => {
  const source = '---\nfirst: 1\nexcalidraw-anchors:\n  - Old\n# Keep this comment\nlast: 2\n---\nText\n';
  const result = syncFrameAnchors(source, [frame("a", "A: \"quote\"")]);
  assert.equal(result, '---\nfirst: 1\nexcalidraw-anchors:\n  - "A: \\"quote\\""\n# Keep this comment\nlast: 2\n---\nText\n'.replaceAll('\\\\"','\\"'));
  assert.equal(syncFrameAnchors('---\nbroken: [\n---\n', [frame("a", "A")]), '---\nbroken: [\n---\n');
  assert.equal(syncFrameAnchors('---\ncustom: 1\n---\n', []), '---\ncustom: 1\n---\n');
  assert.equal(writeFrameProperty(source, "other", "no"), source);
  assert.equal(syncFrameAnchors('---\n---\nBody', [frame("a", "A")]), '---\nexcalidraw-anchors:\n  - "A"\n---\nBody');
  assert.equal(syncFrameAnchors('---\r\nkeep: yes\r\n---\r\nBody', [frame("a", "A")]), '---\r\nexcalidraw-anchors:\r\n  - "A"\r\nkeep: yes\r\n---\r\nBody');
});

test("thumbnail YAML uses exact unique names and supports manual edits, commas and suffixes", () => {
  const scene = [frame("a", "Main,padding=10"), frame("b", "Dupe"), frame("c", "Dupe", "marker")];
  assert.equal(resolveThumbnailFrame(scene, "Main,padding=10")?.id, "a");
  for (const name of [null, "", "Dupe", "a", "missing", []]) assert.equal(resolveThumbnailFrame(scene, name), null);
  const doc = writeFrameProperty('---\nfoo: yes\n---\nBody', "excalidraw-thumbnail", "Main,padding=10");
  assert.equal(readFrameProperty(doc), "Main,padding=10");
  assert.equal(readFrameProperty(writeFrameProperty(doc, "excalidraw-thumbnail", undefined)), undefined);
});
