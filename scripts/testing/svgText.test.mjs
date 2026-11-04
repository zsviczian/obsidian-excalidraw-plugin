import assert from "node:assert/strict";
import test from "node:test";
import { loadConverter } from "./svgConverterHarness.mjs";

const convert = loadConverter();
const options = {
  measureText: (text, fontSize, _fontFamily, lineHeight) => ({
    width:
      (Math.max(...text.split("\n").map((line) => Array.from(line).length)) *
        fontSize) /
      2,
    height: text.split("\n").length * fontSize * lineHeight,
  }),
};
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:h="http://www.w3.org/1999/xhtml" width="400" height="300">${body}</svg>`;
const texts = (result) => {
  assert.equal(result.hasErrors, false, result.errors);
  return result.content.filter((e) => e.type === "text");
};

test("SVG text remains editable text with inherited color, alpha, anchor and baseline", () => {
  const result = convert(
    svg(
      '<g fill="blue" font-size="20" opacity="0.5"><text x="100" y="60" text-anchor="middle" dominant-baseline="central">Hello</text></g>',
    ),
    options,
  );
  const [text] = texts(result);
  assert.equal(text.text, "Hello");
  assert.match(text.id, /^[a-zA-Z0-9]{8}$/);
  assert.equal(text.rawText, "Hello");
  assert.equal(text.originalText, "Hello");
  assert.equal(text.fontSize, 20);
  assert.equal(text.strokeColor, "#0000ff");
  assert.equal(text.opacity, 50);
  assert.equal(text.textAlign, "center");
  assert.equal(text.x, 75);
  assert.equal(text.y, 47.5);
  assert.equal(text.width, 50);
  assert.equal(text.height, 25);
  assert.equal(text.containerId, null);
  assert.ok(text.groupIds.length);
});

test("positioned tspan lines retain text, relative font units and baseline offsets", () => {
  const result = convert(
    svg(
      '<text x="20" y="40" font-size="20"><tspan x="20" dy="0">First</tspan><tspan x="20" dy="1.5em">Second</tspan></text>',
    ),
    options,
  );
  const imported = texts(result);
  assert.deepEqual(
    Array.from(imported, (e) => e.text),
    ["First", "Second"],
  );
  assert.equal(imported[1].y - imported[0].y, 30);
  assert.equal(imported[0].x, 20);
  assert.equal(imported[1].x, 20);
});

test("uniform SVG transforms scale and rotate text with its group", () => {
  const [text] = texts(
    convert(
      svg(
        '<g transform="translate(100 100) rotate(90) scale(2)"><text font-size="16" dominant-baseline="text-before-edge">Hi</text></g>',
      ),
      options,
    ),
  );
  assert.equal(text.fontSize, 32);
  assert.equal(text.width, 32);
  assert.equal(text.height, 40);
  assert.ok(Math.abs(text.angle - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(text.x - 64) < 1e-9);
  assert.ok(Math.abs(text.y - 96) < 1e-9);
});

test("Mermaid foreignObject labels import as native text rather than empty SVG placeholders", () => {
  const result = convert(
    svg(
      '<style>.label{font-size:16px;color:#ffffff}</style><g transform="translate(150 120)"><text><tspan/></text><g class="label" transform="translate(-40 -12)"><foreignObject width="80" height="24"><h:div style="text-align:center;line-height:1.5"><h:span><h:p>Plan &amp; build</h:p></h:span></h:div></foreignObject></g></g>',
    ),
    options,
  );
  const [text] = texts(result);
  assert.equal(texts(result).length, 1);
  assert.equal(text.text, "Plan & build");
  assert.equal(text.strokeColor, "#ffffff");
  assert.equal(text.textAlign, "center");
  assert.equal(text.x + text.width / 2, 150);
  assert.equal(text.y, 108);
  assert.equal(text.height, 24);
  assert.equal(text.lineHeight, 1.5);
  assert.ok(text.groupIds.length >= 2);
});

test("plain HTML label line breaks survive without executing or importing active content", () => {
  const result = convert(
    svg(
      '<foreignObject width="150" height="60"><h:div>First<h:br/>Second<h:script>throw Error("executed")</h:script><h:img src="https://example.test/never.png"/><h:iframe>hidden payload</h:iframe></h:div></foreignObject>',
    ),
    options,
  );
  const [text] = texts(result);
  assert.equal(text.text, "First\nSecond");
  assert.ok(result.warnings.includes("unsupported"));
});

test("empty or hidden SVG/HTML text does not manufacture visible labels", () => {
  const result = convert(
    svg(
      '<text><tspan/></text><text visibility="hidden">Hidden</text><foreignObject display="none" width="100" height="20"><h:p>Hidden HTML</h:p></foreignObject><text xml:space="preserve">  Visible  </text>',
    ),
    options,
  );
  assert.deepEqual(
    Array.from(texts(result), (e) => e.text),
    ["  Visible  "],
  );
});

test("excessive text fails atomically instead of publishing a partial drawing", () => {
  const result = convert(
    svg(
      '<rect width="10" height="10"/><text>' + "x".repeat(100001) + "</text>",
    ),
    options,
  );
  assert.equal(result.hasErrors, true);
  assert.equal(result.content.length, 0);
});

test("text visibility can be restored by a child without exposing hidden siblings", () => {
  const result = convert(
    svg(
      '<text visibility="hidden">hidden<tspan visibility="visible">Shown</tspan></text><foreignObject visibility="hidden" width="100" height="30"><h:span>hidden</h:span><h:span style="visibility:visible">HTML shown</h:span></foreignObject>',
    ),
    options,
  );
  assert.deepEqual(
    Array.from(texts(result), (e) => e.text),
    ["Shown", "HTML shown"],
  );
});

test("unsupported font sizes do not abort ordinary geometry and zero-size text stays hidden", () => {
  const result = convert(
    svg(
      '<g font-size="calc(1em + 2px)"><rect width="20" height="20"/><text>Fallback</text></g><text font-size="0">Zero</text>',
    ),
    options,
  );
  assert.equal(result.hasErrors, false, result.errors);
  assert.equal(result.content.length, 2);
  assert.equal(texts(result)[0].text, "Fallback");
  assert.ok(result.warnings.includes("text"));
});
