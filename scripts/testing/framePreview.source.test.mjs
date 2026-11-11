/** Execute the full production template/export module with only host/export boundaries substituted. */
import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { load } from "js-yaml";

function fixture(property = '"Main,padding=20"') {
  let source = `---\nexcalidraw-plugin: parsed\nexcalidraw-thumbnail: ${property}\n---\n## Drawing\n`;
  const frame = { id: "frame-id", type: "frame", name: "Main,padding=20", x: 10, y: 20, width: 120, height: 80, isDeleted: false };
  let elements = [frame, { id: "in", type: "rectangle", x: 20, y: 30, width: 5, height: 5, frameId: "frame-id" }, { id: "out", type: "rectangle", x: 1000, y: 1000, width: 5, height: 5 }];
  class TFile { path = "Drawing.md"; extension = "md"; }
  const file = new TFile(), requests = [];
  const context = vm.createContext({ console, PLUGIN_VERSION: "test" });
  const compile = (path, mocks) => {
    const code = ts.transpileModule(readFileSync(new URL('../../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {}; vm.runInContext(`(function(require,exports){${code}\n})`, context)(name => mocks[name] ?? {}, exports); return exports;
  };
  const parts = compile('src/utils/embeddedFilenameParts.ts', {});
  const metadata = compile('src/utils/frameMetadata.ts', { obsidian: { parseYaml: load } });
  const api = compile('src/utils/excalidrawAutomateUtils.ts', {
    './frameMetadata': metadata,
    obsidian: { TFile, normalizePath: value => value },
    'src/shared/TextMode': { getTextMode: () => 'parsed' },
    'src/shared/ExcalidrawData': { ExcalidrawData: class {
      scene = { elements: structuredClone(elements), appState: { theme: 'light' }, files: {} };
      async loadData() {} destroy() {}
    }, getExcalidrawMarkdownHeaderSection: value => value },
    'src/utils/utils': { ...parts, getPNG: async (_scene, options) => { requests.push(options); return options; }, getSVG: async (_scene, options) => { requests.push(options); return { viewBox: { baseVal: {} }, setAttribute() {} }; } },
    './excalidrawViewUtils': { getFrameBasedOnFrameNameOrId: name => elements.find(frame => frame.type === 'frame' && (frame.id === name || frame.name === name)) },
    './excalidrawElementUtils': { cloneElement: element => ({ ...element }) },
    'src/constants/safeUrls': { URLs: {} },
  });
  const plugin = { app: { vault: { read: async () => source }, metadataCache: { getFirstLinkpathDest: () => file } }, settings: { exportPaddingSVG: 10 }, ea: { getElementsInFrame: frame => frame ? elements.filter(element => element.id === frame.id || element.frameId === frame.id) : [] } };
  const loader = { loadSceneFiles: async () => {} }, options = { withBackground: false, withTheme: false, isMask: false, drawingThumbnail: true };
  return { api, plugin, loader, options, requests, frame, source: value => { source = value; }, elements: value => { elements = value; } };
}

test("default thumbnails resolve exact YAML names while explicit whole/frame and ordinary exports retain precedence", async () => {
  const f = fixture();
  const get = (target, preview) => f.api.getTemplate(f.plugin, target, false, f.loader, 0, false, undefined, preview);
  assert.equal((await get('Drawing.md', true)).thumbnailFrame.id, 'frame-id');
  assert.equal((await get('Drawing.md#^as-image', true)).thumbnailFrame.id, 'frame-id');
  assert.equal((await get('Drawing.md', false)).thumbnailFrame, undefined);
  const whole = await get('Drawing.md#^frame=', true);
  assert.equal(whole.thumbnailFrame, undefined); assert.equal(whole.elements.length, 3);
  const explicit = await get('Drawing.md#^frame=frame-id', true);
  assert.equal(explicit.thumbnailFrame, undefined); assert.equal(explicit.elements.length, 2);
});

test("missing, ambiguous and invalid thumbnails fall back to the complete scene", async () => {
  for (const value of ['Missing', 'null', '[]', '""']) {
    const f = fixture(value), scene = await f.api.getTemplate(f.plugin, 'Drawing.md', false, f.loader, 0, false, undefined, true);
    assert.equal(scene.thumbnailFrame, undefined); assert.equal(scene.elements.length, 3);
  }
  const f = fixture(); f.elements([f.frame, { ...f.frame, id: 'other', frameRole: 'marker' }]);
  assert.equal((await f.api.getTemplate(f.plugin, 'Drawing.md', false, f.loader, 0, false, undefined, true)).thumbnailFrame, undefined);
});

test("PNG and SVG preview exports forward strict frame cropping without changing full-scene export defaults", async () => {
  const f = fixture();
  await f.api.createPNG('Drawing.md', 1, f.options, f.loader, 'light', undefined, undefined, [], f.plugin, 0);
  await f.api.createSVG('Drawing.md', false, f.options, f.loader, 'light', undefined, undefined, [], f.plugin, 0);
  assert.deepEqual(f.requests.map(options => options.exportingFrame.id), ['frame-id', 'frame-id']);
  await f.api.createPNG('Drawing.md', 1, { ...f.options, drawingThumbnail: false }, f.loader, 'light', undefined, undefined, [], f.plugin, 0);
  assert.equal(f.requests.at(-1).exportingFrame, undefined);
});
