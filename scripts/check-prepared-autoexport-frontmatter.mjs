import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { resolvePreparedAutoexportSettings } = await jiti.import(
  "../src/view/managers/preparedAutoexportFrontmatter.ts",
);

const defaults = {
  exportOptions: {
    theme: "light",
    embedScene: false,
    padding: 10,
    scale: 1,
    withBackground: true,
    includeInternalLinks: true,
    isMask: false,
  },
  autoexportConfig: {
    svg: false,
    png: false,
    excalidraw: true,
    theme: "light",
  },
};

const resolved = resolvePreparedAutoexportSettings(defaults, {
  "excalidraw-autoexport": "both",
  "excalidraw-export-pngscale": 0.1,
  "excalidraw-export-padding": 24,
  "excalidraw-export-dark": true,
  "excalidraw-export-embed-scene": true,
  "excalidraw-export-transparent": true,
  "excalidraw-export-internal-links": false,
  "excalidraw-mask": true,
});

assert.equal(resolved.exportOptions.scale, 0.1);
assert.equal(resolved.exportOptions.padding, 24);
assert.equal(resolved.exportOptions.theme, "dark");
assert.equal(resolved.exportOptions.embedScene, true);
assert.equal(resolved.exportOptions.withBackground, false);
assert.equal(resolved.exportOptions.includeInternalLinks, false);
assert.equal(resolved.exportOptions.isMask, true);
assert.equal(resolved.autoexportConfig.svg, true);
assert.equal(resolved.autoexportConfig.png, true);
assert.equal(resolved.autoexportConfig.excalidraw, true);
assert.equal(resolved.autoexportConfig.theme, "dark");

const bothThemes = resolvePreparedAutoexportSettings(
  {
    ...defaults,
    autoexportConfig: { ...defaults.autoexportConfig, theme: "both" },
  },
  { "excalidraw-export-dark": true },
);
assert.equal(bothThemes.autoexportConfig.theme, "both");

const legacyPadding = resolvePreparedAutoexportSettings(defaults, {
  "excalidraw-export-svgpadding": "31",
  "excalidraw-export-pngscale": "invalid",
});
assert.equal(legacyPadding.exportOptions.padding, 31);
assert.equal(legacyPadding.exportOptions.scale, 1);
assert.deepEqual(
  resolvePreparedAutoexportSettings(defaults, {}),
  defaults,
  "missing metadata must leave save-time plugin defaults intact",
);

process.stdout.write("prepared autoexport frontmatter checks passed\n");
