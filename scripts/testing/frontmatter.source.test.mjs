/** Whole production resolver with reviewed export evidence; these are source cases, not native UI claims. */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { sourceHarness } from "./sourceHarness.mjs";
import { exportCases } from "./behaviorPlan.mjs";
const graph = sourceHarness();
after(() => graph.close());
const { resolvePreparedAutoexportSettings } = await graph.importModule(
  "src/view/managers/preparedAutoexportFrontmatter.ts",
);

const defaults = () => ({
  exportOptions: {
    theme: "light",
    embedScene: true,
    padding: 10,
    scale: 2,
    withBackground: true,
    includeInternalLinks: true,
    isMask: false,
  },
  autoexportConfig: {
    svg: false,
    png: false,
    excalidraw: false,
    theme: "light",
  },
});
for (const row of exportCases)
  test("prepared export pairwise precedence " + row.id, () => {
    const d = defaults(),
      v = row.values,
      fm = {};
    d.exportOptions.withBackground = v.withBackground;
    d.exportOptions.padding = v.padding;
    for (const [factor, key] of [
      ["frontTransparent", "excalidraw-export-transparent"],
      ["frontPadding", "excalidraw-export-padding"],
      ["frontDark", "excalidraw-export-dark"],
    ])
      if (v[factor] !== "missing") fm[key] = v[factor];
    const original = structuredClone(d),
      input = structuredClone(fm),
      result = resolvePreparedAutoexportSettings(d, fm);
    assert.equal(result.exportOptions.withBackground, row.expected.background);
    assert.equal(result.exportOptions.padding, row.expected.padding);
    assert.equal(result.exportOptions.theme, row.expected.theme);
    assert.deepEqual(d, original);
    assert.deepEqual(fm, input);
  });

test("export overrides preserve explicit false and zero while invalid scales retain defaults", () => {
  const d = defaults();
  const result = resolvePreparedAutoexportSettings(d, {
    "excalidraw-export-dark": false,
    "excalidraw-export-transparent": false,
    "excalidraw-export-embed-scene": false,
    "excalidraw-export-internal-links": false,
    "excalidraw-mask": false,
    "excalidraw-export-padding": 0,
    "excalidraw-export-svgpadding": 77,
  });
  assert.deepEqual(result.exportOptions, {
    ...d.exportOptions,
    embedScene: false,
    includeInternalLinks: false,
    padding: 0,
  });
  for (const scale of [undefined, null, false, 0, -1, "invalid", {}, []])
    assert.equal(
      resolvePreparedAutoexportSettings(d, {
        "excalidraw-export-pngscale": scale,
      }).exportOptions.scale,
      2,
    );
  for (const scale of [0.5, 1, "3"])
    assert.equal(
      resolvePreparedAutoexportSettings(d, {
        "excalidraw-export-pngscale": scale,
      }).exportOptions.scale,
      Number(scale),
    );
});

test("autoexport format overrides keep both-theme intent and fall back for missing or unrecognized values", () => {
  const d = defaults();
  d.autoexportConfig = { ...d.autoexportConfig, svg: true, theme: "both" };
  for (const [value, svg, png] of [
    ["none", false, false],
    ["png", false, true],
    ["svg", true, false],
    ["both", true, true],
    ["PNG", false, true],
    [undefined, true, false],
    ["invalid", true, false],
  ]) {
    const result = resolvePreparedAutoexportSettings(d, {
      "excalidraw-autoexport": value,
      "excalidraw-export-dark": true,
    });
    assert.deepEqual(result.autoexportConfig, {
      ...d.autoexportConfig,
      svg,
      png,
      theme: "both",
    });
  }
});
