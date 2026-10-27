import assert from "node:assert/strict";
import test from "node:test";
import { loadConverter } from "./svgConverterHarness.mjs";

const convert = loadConverter();
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
test("SVG alpha uses percent units and preserves zero and near-zero opacity", () => {
  for (const opacity of [0, 0.005, 0.5, 1]) {
    const result = convert(
      svg(`<rect width="20" height="10" opacity="${opacity}"/>`),
    );
    assert.equal(result.hasErrors, false);
    assert.equal(result.content[0].opacity, opacity * 100);
  }
});
test("root styles inherit to open primitives without closing their strokes", () => {
  const result = convert(
    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" color="red"><line x1="1" y1="2" x2="10" y2="8"/><path d="M1 2L10 8"/></svg>',
  );
  assert.equal(result.hasErrors, false);
  assert.equal(result.content.length, 2);
  for (const element of result.content) {
    assert.equal(element.type, "line");
    assert.equal(element.polygon, false);
    assert.equal(element.backgroundColor, "transparent");
    assert.equal(element.strokeColor, "#ff0000");
  }
});
test("compound holes never become white patches", () => {
  const result = convert(
    svg('<path fill="red" d="M0 0H30V30H0Z M10 10V20H20V10Z"/>'),
  );
  assert.equal(result.hasErrors, false);
  assert.ok(result.content.length > 0);
  assert.ok(
    result.content.every(
      (element) => !/white|#fff(?:fff)?$/i.test(element.backgroundColor),
    ),
  );
});

function elements(body, root = "") {
  const result = convert(
    `<svg xmlns="http://www.w3.org/2000/svg" ${root}>${body}</svg>`,
  );
  assert.equal(result.hasErrors, false, result.errors);
  return result.content;
}
function inside(element, x, y) {
  if (element.type !== "line" || element.backgroundColor === "transparent")
    return false;
  const ring = element.points.map((p) => [p[0] + element.x, p[1] + element.y]);
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > y !== b[1] > y &&
      x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
    )
      hit = !hit;
  }
  return hit;
}

test("holes expose the underlying scene; nested islands and disjoint regions retain fill", () => {
  const output = elements(
    '<path fill="red" fill-rule="evenodd" d="M0 0H40V40H0Z M5 5H35V35H5Z M10 10H30V30H10Z M50 0H60V10H50Z"/>',
  );
  for (const [x, y, expected] of [
    [2, 2, true],
    [7, 7, false],
    [20, 20, true],
    [55, 5, true],
    [45, 5, false],
  ])
    assert.equal(
      output.some((e) => inside(e, x, y)),
      expected,
      `${x},${y}`,
    );
});
test("nonzero and evenodd distinguish same-winding nested contours", () => {
  for (const [rule, filled] of [
    ["nonzero", true],
    ["evenodd", false],
  ]) {
    const output = elements(
      `<path fill-rule="${rule}" d="M0 0H30V30H0Z M10 10H20V20H10Z"/>`,
    );
    assert.equal(
      output.some((e) => inside(e, 15, 15)),
      filled,
    );
  }
});
test("intersecting contours and self-intersections follow the selected fill rule", () => {
  for (const [rule, overlap] of [
    ["nonzero", true],
    ["evenodd", false],
  ]) {
    const output = elements(
      `<path fill-rule="${rule}" d="M0 0H20V20H0Z M10 0H30V20H10Z"/>`,
    );
    assert.equal(
      output.some((e) => inside(e, 5, 10)),
      true,
    );
    assert.equal(
      output.some((e) => inside(e, 15, 10)),
      overlap,
    );
    assert.equal(
      output.some((e) => inside(e, 25, 10)),
      true,
    );
  }
  const bow = elements('<path d="M0 0L20 20L0 20L20 0Z"/>');
  assert.equal(
    bow.some((e) => inside(e, 10, 3)),
    true,
  );
  assert.equal(
    bow.some((e) => inside(e, 10, 17)),
    true,
  );
  assert.equal(
    bow.some((e) => inside(e, 1, 10)),
    false,
  );
});
test("overlapping nonzero contours produce no doubly painted translucent area", () => {
  const output = elements(
    '<path fill="rgba(255,0,0,0.5)" d="M0 0H20V20H0Z M10 0H30V20H10Z"/>',
  );
  assert.equal(output.filter((e) => inside(e, 15, 10)).length, 1);
});
test("opposite overlapping windings cancel only their shared area", () => {
  const output = elements('<path d="M0 0H20V20H0Z M10 0V20H30V0Z"/>');
  assert.equal(
    output.some((e) => inside(e, 5, 10)),
    true,
  );
  assert.equal(
    output.some((e) => inside(e, 15, 10)),
    false,
  );
  assert.equal(
    output.some((e) => inside(e, 25, 10)),
    true,
  );
});
test("fill closure does not close an open stroke or draw bridges as strokes", () => {
  const output = elements('<path fill="red" stroke="blue" d="M0 0H20V20"/>');
  assert.equal(output.length, 2);
  assert.equal(output[0].strokeColor, "transparent");
  assert.equal(output[1].polygon, false);
  assert.notDeepEqual([...output[1].points[0]], [...output[1].points.at(-1)]);
  const hole = elements(
    '<path fill="red" stroke="blue" d="M0 0H30V30H0Z M10 10V20H20V10Z"/>',
  );
  assert.equal(hole.filter((e) => e.strokeColor === "#0000ff").length, 2);
  assert.ok(hole.every((e) => e.groupIds[0] === hole[0].groupIds[0]));
});
test("paint precedence and independent alpha do not depend on attribute order", () => {
  const variants = [
    'fill="red" fill-opacity="0.25" stroke="blue" stroke-opacity="0.5"',
    'stroke-opacity="0.5" fill-opacity="0.25" stroke="blue" fill="red"',
  ];
  for (const attrs of variants) {
    const [e] = elements(`<rect width="20" height="10" ${attrs}/>`);
    assert.equal(e.backgroundColor, "#ff000040");
    assert.equal(e.strokeColor, "#0000ff80");
    assert.equal(e.opacity, 100);
  }
  const [e] = elements(
    '<g fill="red" color="green"><rect width="20" height="10" fill="blue" style="fill:currentColor"/></g>',
  );
  assert.equal(e.backgroundColor, "#008000");
});
test("local CSS resolves class, ID, descendant and inline precedence without host CSS", () => {
  const [e] = elements(
    '<style>rect{fill:red}.box{fill:blue}g .box{fill:green}#one{fill:yellow}</style><g><rect id="one" class="box" width="10" height="10" style="fill:purple"/></g>',
  );
  assert.equal(e.backgroundColor, "#800080");
  assert.ok(
    convert(
      svg(
        '<style>@import url(https://example.test/style.css);rect:hover{fill:red}</style><rect width="10" height="10"/>',
      ),
    ).warnings.includes("css"),
  );
});
test("object/group opacity is not inherited as a presentation value and approximations are explicit", () => {
  const result = convert(
    svg(
      '<g opacity="0.5"><rect width="20" height="20"/><g opacity="0.5"><rect x="10" width="20" height="20"/></g></g>',
    ),
  );
  assert.equal(result.hasErrors, false);
  assert.deepEqual(result.content.map((e) => e.opacity).join(","), "50,25");
  assert.ok(result.warnings.includes("compositing"));
});
test("rendering-tree paint order and all ancestor groups survive native emission", () => {
  const output = elements(
    '<rect fill="red" width="2" height="2"/><g><circle fill="blue" r="1"/><g><path fill="yellow" d="M0 0H1V1Z"/></g></g><rect fill="green" width="2" height="2"/>',
  );
  assert.equal(
    output.map((e) => e.backgroundColor).join(","),
    "#ff0000,#0000ff,#ffff00,#008000",
  );
  assert.equal(output[2].groupIds.length, 2);
  assert.equal(output[2].groupIds.at(-1), output[1].groupIds.at(-1));
});
test("viewBox origins, CSS lengths and preserveAspectRatio map to the requested viewport", () => {
  const [e] = elements(
    '<rect x="10" y="20" width="20" height="10"/>',
    'viewBox="10 20 20 10" width="2in" height="1in"',
  );
  assert.equal(e.x, 0);
  assert.equal(e.y, 0);
  assert.equal(e.width, 192);
  assert.equal(e.height, 96);
  const [aligned] = elements(
    '<rect width="20" height="10"/>',
    'viewBox="0 0 20 10" width="100" height="100"',
  );
  assert.equal(aligned.y, 25);
  assert.equal(aligned.height, 50);
  const [stretched] = elements(
    '<rect width="20" height="10"/>',
    'viewBox="0 0 20 10" width="100" height="100" preserveAspectRatio="none"',
  );
  assert.equal(stretched.height, 100);
});
test("transforms compose in SVG order and rotate around their explicit center", () => {
  const [line] = elements(
    '<g transform="translate(5 7)"><line x1="10" y1="10" x2="20" y2="10" transform="rotate(90 10 10)"/></g>',
    'fill="none" stroke="black"',
  );
  assert.ok(Math.abs(line.x - 15) < 1e-8);
  assert.ok(Math.abs(line.y - 17) < 1e-8);
  assert.ok(Math.abs(line.points[1][0]) < 1e-8);
  assert.ok(Math.abs(line.points[1][1] - 10) < 1e-8);
});
test("rotated, reflected and skewed primitives retain their affine geometry", () => {
  const [rect] = elements(
    '<rect width="20" height="10" transform="rotate(90)"/>',
  );
  assert.ok(Math.abs(rect.angle - Math.PI / 2) < 1e-8);
  assert.ok(rect.width > 0 && rect.height > 0);
  const [reflected] = elements(
    '<rect width="20" height="10" transform="scale(-1 1)"/>',
  );
  assert.ok(reflected.width > 0 && reflected.height > 0);
  const [skewed] = elements(
    '<rect width="20" height="10" transform="skewX(30)"/>',
  );
  assert.equal(skewed.type, "line");
  assert.ok(skewed.width > 20);
  const [ellipse] = elements(
    '<ellipse cx="10" cy="10" rx="8" ry="4" transform="rotate(30)"/>',
  );
  assert.ok(Math.abs(ellipse.angle - Math.PI / 6) < 1e-8);
  assert.ok(Math.abs(ellipse.width - 16) < 1e-8);
});
test("local use references retain every child, instance styling and fresh identities", () => {
  const output = elements(
    '<defs><g id="pair"><rect width="2" height="2"/><circle cx="5" cy="5" r="1"/></g></defs><use href="#pair" fill="red"/><use href="#pair" x="10" fill="blue"/>',
  );
  assert.equal(output.length, 4);
  assert.equal(new Set(output.map((e) => e.id)).size, 4);
  assert.equal(
    output.map((e) => e.backgroundColor).join(","),
    "#ff0000,#ff0000,#0000ff,#0000ff",
  );
  assert.equal(output[2].x - output[0].x, 10);
  assert.notEqual(output[0].groupIds.at(-1), output[2].groupIds.at(-1));
});
test("symbol and nested SVG viewports use instance dimensions", () => {
  const output = elements(
    '<defs><symbol id="s" viewBox="0 0 10 10"><rect width="10" height="10"/></symbol></defs><use href="#s" x="20" width="50" height="50"/><svg x="90" y="10" width="20" height="20" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
  );
  assert.equal(output.length, 2);
  assert.equal(output[0].x, 20);
  assert.equal(output[0].width, 50);
  assert.equal(output[1].x, 90);
  assert.equal(output[1].y, 10);
  assert.equal(output[1].width, 20);
});
test("curves, relative commands and arcs preserve endpoints with bounded point counts", () => {
  const output = elements(
    '<path d="M0 0c0 10 10 10 10 0a5 5 0 0 1 10 0q5 10 10 0t10 0"/>',
    'fill="none" stroke="black"',
  );
  assert.equal(output.length, 1);
  assert.equal(output[0].polygon, false);
  assert.ok(output[0].points.length > 8 && output[0].points.length < 300);
  assert.ok(Math.abs(output[0].points.at(-1)[0] - 40) < 1e-8);
});
test("round-cap zero-length strokes remain editable dots; zero dimensions remain empty", () => {
  const output = elements(
    '<path d="M5 5h0"/>',
    'fill="none" stroke="red" stroke-width="2" stroke-linecap="round"',
  );
  assert.equal(output.length, 1);
  assert.equal(output[0].type, "ellipse");
  assert.equal(output[0].width, 2);
  assert.equal(output[0].backgroundColor, "#ff0000");
  assert.equal(
    elements('<rect width="0" height="10"/><circle r="0"/>').length,
    0,
  );
});
test("hidden containers, definition-only nodes and namespace prefixes are traversed deliberately", () => {
  assert.equal(
    elements(
      '<g display="none"><rect width="10" height="10"/></g><defs><rect width="2" height="2"/></defs>',
    ).length,
    0,
  );
  assert.equal(
    elements(
      '<g visibility="hidden"><rect width="10" height="10"/><rect width="2" height="2" visibility="visible"/></g>',
    ).length,
    1,
  );
  const result = convert(
    '<s:svg xmlns:s="http://www.w3.org/2000/svg"><s:rect width="10" height="10"/></s:svg>',
  );
  assert.equal(result.content.length, 1);
});
for (const body of [
  '<rect width="10" height="10"/><path d="M0 0Z 1"/>',
  '<path d="M1"/>',
  '<path d="M0 0A1 1 0 2 0 10 10"/>',
  '<use href="https://example.test/a.svg#x"/>',
  '<use href="#missing"/>',
  '<defs><g id="loop"><use href="#loop"/></g></defs><use href="#loop"/>',
  '<g transform="scale(1e30)"><rect width="10" height="10"/></g>',
  '<rect width="-1" height="10"/>',
])
  test(`failed conversion is atomic: ${body.slice(0, 55)}`, () => {
    const result = convert(svg(body));
    assert.equal(result.hasErrors, true);
    assert.equal(result.content.length, 0);
    assert.ok(result.errors);
  });
test("untrusted scripts/styles/images never execute or fetch and unsupported content is diagnosed", () => {
  const result = convert(
    svg(
      '<script>throw Error("executed")</script><image href="https://example.test/image.png"/><rect width="10" height="10" fill="url(https://example.test/paint.svg#x)"/>',
    ),
  );
  assert.equal(result.hasErrors, false);
  assert.ok(result.warnings.includes("unsupported"));
  assert.equal(result.content[0].backgroundColor, "transparent");
  assert.equal(
    convert('<!DOCTYPE svg [<!ENTITY x "boom">]><svg/>').hasErrors,
    true,
  );
  assert.equal(convert("<svg><g></svg>").hasErrors, true);
});
test("document depth and input size are bounded before scene publication", () => {
  assert.equal(
    convert(
      svg(
        "<g>".repeat(140) + '<rect width="1" height="1"/>' + "</g>".repeat(140),
      ),
    ).hasErrors,
    true,
  );
  assert.equal(convert(" ".repeat(2000001)).hasErrors, true);
});
test("repeated imports get new element and group identities", () => {
  const input = '<g><rect width="10" height="10"/><circle r="1"/></g>';
  const a = elements(input),
    b = elements(input);
  assert.ok(
    a.every(
      (e) =>
        !b.some(
          (other) =>
            other.id === e.id ||
            other.groupIds.some((id) => e.groupIds.includes(id)),
        ),
    ),
  );
});
test("primitive stroke-before-fill order is preserved without a stroke seam", () => {
  const output = elements(
    '<rect width="20" height="10" fill="red" stroke="blue" stroke-width="4" paint-order="stroke fill"/>',
  );
  assert.equal(output.length, 2);
  assert.equal(output[0].strokeColor, "#0000ff");
  assert.equal(output[0].backgroundColor, "transparent");
  assert.equal(output[1].backgroundColor, "#ff0000");
  assert.equal(output[1].strokeColor, "transparent");
});
test("non-scaling strokes remain constant under nonuniform affine transforms", () => {
  const result = convert(
    svg(
      '<line x1="0" y1="0" x2="10" y2="10" transform="scale(2 3)" fill="none" stroke="red" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>',
    ),
  );
  assert.equal(result.content[0].strokeWidth, 2);
  assert.ok(!result.warnings.includes("stroke"));
});
test("bounded fill topology agrees with independent rectangle winding samples", () => {
  let random = 291;
  const next = () => {
    random = (random * 1664525 + 1013904223) >>> 0;
    return random;
  };
  for (let fixture = 0; fixture < 30; fixture++) {
    const rectangles = Array.from({ length: 5 }, () => ({
      x: next() % 15,
      y: next() % 15,
      w: 2 + (next() % 8),
      h: 2 + (next() % 8),
      reverse: next() % 2 === 0,
    }));
    const path = rectangles
      .map((r) =>
        r.reverse
          ? `M${r.x} ${r.y}v${r.h}h${r.w}v${-r.h}Z`
          : `M${r.x} ${r.y}h${r.w}v${r.h}h${-r.w}Z`,
      )
      .join(" ");
    for (const rule of ["nonzero", "evenodd"]) {
      const output = elements(`<path fill-rule="${rule}" d="${path}"/>`);
      for (let y = 0.37; y < 24; y += 2.13)
        for (let x = 0.23; x < 24; x += 2.17) {
          const n = rectangles.reduce(
            (sum, r) =>
              sum +
              (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h
                ? r.reverse
                  ? -1
                  : 1
                : 0),
            0,
          );
          assert.equal(
            output.some((e) => inside(e, x, y)),
            rule === "evenodd" ? Math.abs(n) % 2 !== 0 : n !== 0,
            `${fixture}/${rule}/${x}/${y}`,
          );
        }
    }
  }
});
test("outer image clipping is diagnosed without replacing editable output", () => {
  const result = convert(
    '<svg width="20" height="20"><rect x="-10" width="30" height="30"/></svg>',
  );
  assert.equal(result.hasErrors, false);
  assert.equal(result.content[0].type, "rectangle");
  assert.ok(result.warnings.includes("viewport"));
});
test("use without instance dimensions preserves the referenced SVG's own viewport", () => {
  const [e] = elements(
    '<defs><svg id="s" width="10" height="20" viewBox="0 0 10 20"><rect width="10" height="20"/></svg></defs><use href="#s" x="30"/>',
  );
  assert.equal(e.x, 30);
  assert.equal(e.width, 10);
  assert.equal(e.height, 20);
});
test("zero-radius and coincident-endpoint arcs follow SVG degeneracy rules", () => {
  const [line] = elements(
    '<path d="M0 0A0 5 0 0 1 20 10A5 5 0 0 0 20 10"/>',
    'fill="none" stroke="black"',
  );
  assert.equal(line.points.length, 2);
  assert.deepEqual([...line.points[1]], [20, 10]);
});
test("paint order accounts for an omitted marker operation", () => {
  const output = elements(
    '<rect width="20" height="10" fill="red" stroke="blue" paint-order="markers stroke"/>',
  );
  assert.equal(output[0].backgroundColor, "transparent");
  assert.equal(output[1].strokeColor, "transparent");
});
test("unsupported geometric CSS is explicitly diagnosed", () => {
  assert.ok(
    convert(
      svg('<rect width="10" height="10" style="width:20px"/>'),
    ).warnings.includes("css"),
  );
});
test("dense simple filled outlines retain existing import support within bounded work", () => {
  const points = Array.from({ length: 6000 }, (_, i) => {
    const a = (i * Math.PI * 2) / 6000;
    return `${50 + 40 * Math.cos(a)},${50 + 40 * Math.sin(a)}`;
  }).join(" ");
  const result = convert(svg(`<polygon points="${points}"/>`));
  assert.equal(result.hasErrors, false, result.errors);
  assert.equal(result.content.length, 1);
});
test("dense compound outlines retain transparent holes without quadratic work",()=>{
  const ring=(count,radius,reverse)=>Array.from({length:count},(_,i)=>{const a=i*Math.PI*2/count*(reverse?-1:1);return `${50+radius*Math.cos(a)} ${50+radius*Math.sin(a)}`;});
  for(const rule of ["evenodd","nonzero"]){
    const a=ring(4000,40,false),b=ring(400,20,rule==="nonzero");
    const output=elements(`<path fill-rule="${rule}" d="M${a.join("L")}Z M${b.join("L")}Z"/>`);
    assert.equal(output.length,1);assert.equal(output.some(e=>inside(e,50,50)),false);assert.equal(output.some(e=>inside(e,15,50)),true);
  }
});
