import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFileSync } from "node:fs";
import { DOMParser as XMLParser } from "@xmldom/xmldom";
import { sourceHarness } from "./sourceHarness.mjs";
const before = globalThis.DOMParser;
globalThis.DOMParser = class {
  parseFromString(source, mime) {
    try { return new XMLParser({ onError: () => { throw Error("Invalid XML"); } }).parseFromString(source, mime); }
    catch { return new XMLParser().parseFromString("<parsererror>Invalid XML</parsererror>", mime); }
  }
};
const graph = sourceHarness({
  "roughjs/bin/math": { Random: class { next() { return 0.5; } } },
  "src/constants/constants": { ROUNDNESS: { LEGACY: 1 } },
  "src/constants/safeUrls": { URLs: { GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_RELEASES_TAG: "https://example.test/releases" } },
  "src/utils/debugHelper": { log() {} },
});
after(() => { graph.close(); globalThis.DOMParser = before; });
const { svgToExcalidraw: convert } = await graph.importModule("src/shared/svgToExcalidraw/parser.ts");
test("whole-module SVG conversion preserves opacity, transforms and open strokes", () => {
  const output = convert('<svg xmlns="http://www.w3.org/2000/svg"><g transform="translate(10 20)"><rect width="20" height="10" opacity="0.5"/><path d="M0 0L20 10" fill="none" stroke="red"/></g></svg>');
  assert.equal(output.hasErrors, false); assert.equal(output.content.length, 2);
  assert.equal(output.content[0].x, 10); assert.equal(output.content[0].y, 20); assert.equal(output.content[0].opacity, 50);
  assert.equal(output.content[1].backgroundColor, "transparent"); assert.equal(output.content[1].strokeColor, "#ff0000");
});
test("whole-module SVG fixture imports without mutating source bytes", () => {
  const bytes = readFileSync(new URL("../../tests/vault/Assets/Layers.svg", import.meta.url), "utf8");
  const first = convert(bytes), second = convert(bytes);
  assert.equal(first.hasErrors, false); assert.equal(second.hasErrors, false);
  assert.equal(first.content.length, 3); assert.equal(first.content[0].opacity, 50);
  assert.equal(readFileSync(new URL("../../tests/vault/Assets/Layers.svg", import.meta.url), "utf8"), bytes);
});
test("malformed SVG reports a failed conversion and a later request still works", () => {
  assert.equal(convert("not an SVG").hasErrors, true);
  assert.equal(convert('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="5"/></svg>').hasErrors, false);
});
