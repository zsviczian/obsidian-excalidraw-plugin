import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { sourceHarness } from "./sourceHarness.mjs";
const root = resolve(import.meta.dirname, "../..");

async function fixture() {
  const previousWindow = globalThis.window;
  globalThis.window = globalThis;
  const graph = sourceHarness({
    obsidian: { Notice: class {} },
    "src/lang/helpers": { t: (key) => key },
    "../utils/utils": { convertSVGStringToElement() {}, errorlog() {} },
    "../utils/debugHelper": { log() {} },
    "../types/utilTypes": {
      PreviewImageType: { PNG: "PNG", SVGIMG: "SVGIMG", SVG: "SVG" },
    },
    "../utils/fileUtils": {
      hasExcalidrawEmbeddedImagesTreeChanged: () => false,
    },
    "src/constants/constants": {
      EXCALIDRAW_PLUGIN: { app: { appId: "owned-raster-regression" } },
    },
    "../utils/coreUtils": { blobToDataURL() {} },
    "../utils/typechecks": { isInstanceOfSVGSVGElement: () => false },
    "./BackupPersistenceQueue": {
      BackupPersistenceQueue: class {
        destroy() {}
      },
    },
  });
  const { getImageCache } = await graph.importModule(
    "src/shared/ImageCache.ts",
  );
  const cache = getImageCache(),
    stores = new Map(),
    requests = [],
    urls = new Set();
  const store = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  };
  const file = { path: "owned.excalidraw.md", stat: { mtime: 0 } };
  const plugin = {
    settings: { allowImageCache: true },
    register() {},
    app: {
      vault: { getFileByPath: () => file },
      metadataCache: {},
    },
  };
  cache.app = plugin.app;
  cache.plugin = plugin;
  cache.db = {
    close() {},
    transaction: () => ({
      objectStore: (name) => ({
        put: (value, key) => store(name).set(key, value),
        delete: (key) => store(name).delete(key),
      }),
    }),
  };
  cache.ensureCacheStoreReady = async () => {};
  cache.getCacheData = async (key) => store("imageCacheV2").get(key);
  class Image {
    src = "";
    listeners = new Map();
    addEventListener(name, callback, options) {
      this.listeners.set(name, { callback, options });
    }
    removeEventListener(name, callback) {
      if (this.listeners.get(name)?.callback === callback)
        this.listeners.delete(name);
    }
    fire(name) {
      const entry = this.listeners.get(name);
      if (entry?.options?.once) this.listeners.delete(name);
      entry?.callback();
    }
  }
  const mocks = {
    "../../shared/ImageCache": { getImageCache: () => cache },
    "../../types/utilTypes": { PreviewImageType: { PNG: "PNG" } },
    "../../utils/utils": {
      getEmbeddedFilenameParts: () => ({}),
      isImagePartRef: () => false,
      getQuickImagePreview: async () => undefined,
      getExportPadding: () => 10,
    },
    "../../utils/typechecks": {
      isInstanceOfHTMLImageElement: (image) => image instanceof Image,
    },
    "../../utils/excalidrawAutomateUtils": {
      createPNG: () => new Promise((resolve) => requests.push(resolve)),
    },
  };
  const source =
    readFileSync(
      resolve(root, "src/core/managers/MarkdownPostProcessor.ts"),
      "utf8",
    ) + "\nexport { _getPNG, discardImage };";
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const context = vm.createContext({
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    URL: {
      createObjectURL: (blob) => {
        const url = URL.createObjectURL(blob);
        urls.add(url);
        return url;
      },
      revokeObjectURL: (url) => URL.revokeObjectURL(url),
    },
  });
  const exports = {};
  vm.runInContext(`(function(require,exports){${code}\n})`, context)(
    (name) => mocks[name] ?? {},
    exports,
  );
  exports.initializeMarkdownPostProcessor(plugin);
  const key = {
    filepath: file.path,
    cacheId: "frame-thumbnail-v2",
    previewImageType: "PNG",
    scale: 1,
    isDark: false,
    isTransparent: false,
    inlineFonts: true,
  };
  const render = (img, cacheReady = true) =>
    exports._getPNG({
      imgAttributes: { fname: file.path, fwidth: "180" },
      filenameParts: { filepath: file.path },
      theme: "light",
      cacheReady,
      img,
      file,
      exportSettings: { withBackground: true },
      loader: {},
    });
  return {
    cache,
    key,
    requests,
    Image,
    render,
    discard: exports.discardImage,
    close() {
      cache.destroy();
      for (const url of urls) URL.revokeObjectURL(url);
      graph.close();
      if (previousWindow === undefined) delete globalThis.window;
      else globalThis.window = previousWindow;
    },
  };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
const blob = (text) => new Blob([text], { type: "image/png" });

test("concurrent cold PNG renders keep both renderer URLs alive until each image settles", async () => {
  const f = await fixture();
  try {
    const a = new f.Image(),
      b = new f.Image(),
      first = f.render(a),
      second = f.render(b);
    await flush();
    assert.equal(f.requests.length, 2);
    f.requests[0](blob("first"));
    await first;
    f.requests[1](blob("second"));
    await second;
    assert.equal(await (await fetch(a.src)).text(), "first");
    assert.equal(await (await fetch(b.src)).text(), "second");
    assert.notEqual(a.src, b.src);
    a.fire("load");
    await assert.rejects(fetch(a.src));
    assert.equal(await (await fetch(b.src)).text(), "second");
    assert.equal(a.listeners.size, 0, "both terminal listeners are removed");
    b.fire("error");
    await assert.rejects(fetch(b.src));
    assert.equal(b.listeners.size, 0);
    assert.equal(
      (await f.cache.getImageCacheData(f.key)).blob.type,
      "image/png",
    );
  } finally {
    f.close();
  }
});

test("warm PNG cache hits have independent URLs and discarding one preserves its sibling", async () => {
  const f = await fixture();
  try {
    f.cache.addImageToCache(f.key, "", blob("cached"));
    const a = new f.Image(),
      b = new f.Image();
    await Promise.all([f.render(a), f.render(b)]);
    assert.equal(f.requests.length, 0, "warm hits never export again");
    assert.notEqual(a.src, b.src);
    const old = a.src;
    f.discard(a);
    await assert.rejects(fetch(old));
    assert.equal(await (await fetch(b.src)).text(), "cached");
    b.fire("load");
    await assert.rejects(fetch(b.src));
  } finally {
    f.close();
  }
});

test("uncached PNG load and error both release their owned URLs without populating the cache", async () => {
  for (const terminal of ["load", "error"]) {
    const f = await fixture();
    try {
      const img = new f.Image(),
        task = f.render(img, false);
      await flush();
      f.requests[0](blob(terminal));
      await task;
      assert.equal(await (await fetch(img.src)).text(), terminal);
      img.fire(terminal);
      await assert.rejects(fetch(img.src));
      assert.equal(await f.cache.getImageCacheData(f.key), undefined);
    } finally {
      f.close();
    }
  }
});
