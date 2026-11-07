import assert from "node:assert/strict";
import test, { after } from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";
const graph = sourceHarness();
const { readTableEmbedToken: locate } = await graph.importModule("src/core/editor/tableEmbedSource.ts");
const { rewriteEmbedDimensions, parseEmbedAlias } = await graph.importModule("src/core/editor/embedDimensions.ts");
after(() => graph.close());

test("physical table cells locate repeated escaped embeds without global occurrence matching", () => {
  const token = "![[Drawings/Map.excalidraw.md#^frame=Frame name\\|Caption\\|100\\|left]]";
  const table = `| Drawing | Note |\n| :--- | ---: |\n| ${token} | first |\n| ${token} | second |\n`;
  const first = locate(table, 25, 1, 0, 3, 2), second = locate(table, 25, 2, 0, 3, 2);
  assert.equal(first.from, 25 + table.indexOf(token)); assert.equal(second.from, 25 + table.lastIndexOf(token));
  assert.equal(second.text, token); assert.equal(second.target, "Drawings/Map.excalidraw.md#^frame=Frame name");
  const edited = rewriteEmbedDimensions(second.text, { width: 108 });
  assert.equal(edited, token.replace("100", "108"));
  assert.equal(table.slice(0, second.from - 25) + edited + table.slice(second.from - 25 + token.length), table.replace(token + " | second", edited + " | second"));
  assert.deepEqual(parseEmbedAlias("Caption\\|100\\|left"), { alias: "Caption", width: "100", style: "left" });
});

test("Markdown titles, Unicode, optional outer pipes and escaped code pipes retain exact source", () => {
  const token = '![图例\\|50%](<绘图/地图.excalidraw.md#^group=abcdefgh> "Keep title")';
  const table = `Drawing | Code\n--- | ---\n ${token} | \`x\\|y\`\n`;
  assert.equal(locate(table, 0, 1, 0, 2, 2).text, token);
  const header = `| ![[Header\\|80]] | Name |\n| --- | --- |\n`;
  assert.equal(locate(header, 10, 0, 0, 1, 2).from, 12);
  const slashes = `| Code | Drawing |\n| --- | --- |\n| \\ | ![[Map\\|100]] |\n`;
  assert.equal(locate(slashes, 0, 1, 1, 2, 2).text, "![[Map\\|100]]");
});

test("ragged, mismatched, ambiguous, nested and non-embed cells never acquire editable ranges", () => {
  const table = "| Image | Note |\n| --- | --- |\n| ![[Map]] | keep |\n";
  for (const args of [[0,1,0,3,2], [0,1,0,2,3], [0,2,0,2,2], [-1,1,0,2,2], [0,1,2,2,2]]) assert.equal(locate(table, ...args), null);
  for (const source of [
    table.replace("--- | ---", "text | ---"), table.replace("| keep |", "| keep | extra |"),
    table.replace("![[Map]]", "![[Map]] ![[Map]]"), table.replace("![[Map]]", "`![[Map]]`"),
    table.replaceAll("|", "> |"), table + "not part of the table\n",
  ]) assert.equal(locate(source, 0, 1, 0, 2, 2), null);
  assert.equal(locate(table, 0, 1, 1, 2, 2), null);
});
