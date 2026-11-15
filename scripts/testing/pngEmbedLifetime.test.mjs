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
  const previousCreateEl = globalThis.createEl;
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
  const ownedPNG = await graph.importModule("src/utils/ownedPNGImage.ts");
  const images = new Set();
  const cache = getImageCache(),
    stores = new Map(),
    requests = [],
    urls = new Set();
  const store = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  };
  const file = { path: "owned.excalidraw.md", stat: { mtime: 0 } };
  const pluginCleanups = [];
  const disposePlugin = () => {
    for (const cleanup of pluginCleanups.splice(0).reverse()) cleanup();
  };
  const plugin = {
    settings: { allowImageCache: true },
    register: (cleanup) => pluginCleanups.push(cleanup),
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
    constructor() {
      images.add(this);
    }
    value = "";
    complete = false;
    naturalWidth = 0;
    ownerDocument = { adoptNode(image) { image.ownerDocument = this; return image; } };
    classes = new Set();
    hasClass(name) { return this.classes.has(name); }
    set src(value) {
      this.value = value;
      this.complete = false;
      this.naturalWidth = 0;
    }
    get src() {
      return this.value;
    }
    listeners = new Map();
    addEventListener(name, callback, options) {
      this.listeners.set(name, { callback, options });
    }
    removeEventListener(name, callback) {
      if (this.listeners.get(name)?.callback === callback)
        this.listeners.delete(name);
    }
    fire(name, complete = true) {
      this.complete = complete;
      this.naturalWidth = name === "load" ? 1 : 0;
      const entry = this.listeners.get(name);
      if (entry?.options?.once) this.listeners.delete(name);
      entry?.callback();
    }
  }
  globalThis.createEl = (tag, options) => {
    assert.equal(tag, "img");
    const image = new Image();
    image.classes = new Set((options?.cls ?? "").split(" ").filter(Boolean));
    return image;
  };
  const mocks = {
    "../../utils/ownedPNGImage": ownedPNG,
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
    disposePlugin,
    ownedPNG,
    close() {
      disposePlugin();
      for (const image of images) ownedPNG.discardOwnedPNGImage(image);
      if (cache.isReady()) cache.destroy();
      for (const url of urls) URL.revokeObjectURL(url);
      graph.close();
      if (previousWindow === undefined) delete globalThis.window;
      else globalThis.window = previousWindow;
      if (previousCreateEl === undefined) delete globalThis.createEl;
      else globalThis.createEl = previousCreateEl;
    },
  };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
const blob = (text) => new Blob([text], { type: "image/png" });

test("fullscreen PNG copies reuse displayed pixels without another export and own independent URLs", async () => {
  for (const cacheReady of [true, false]) {
    const f = await fixture();
    try {
      const inline = new f.Image(), task = f.render(inline, cacheReady);
      await flush(); f.requests[0](blob("displayed-frame-crop-theme")); await task;
      inline.fire("load");
      const preview = f.ownedPNG.cloneOwnedPNGImage(inline);
      assert.ok(preview);
      assert.equal(preview.ownerDocument, inline.ownerDocument);
      assert.ok(preview.hasClass("excalidraw-embedded-img"));
      assert.notEqual(preview.src, inline.src);
      assert.equal(await (await fetch(preview.src)).text(), "displayed-frame-crop-theme");
      assert.equal(f.requests.length, 1, "opening fullscreen must not export another raster");
      const previewURL = preview.src; f.discard(preview);
      await assert.rejects(fetch(previewURL));
      assert.equal(await (await fetch(inline.src)).text(), "displayed-frame-crop-theme");
      const reopened = f.ownedPNG.cloneOwnedPNGImage(inline);
      assert.notEqual(reopened.src, previewURL);
      f.discard(inline);
      assert.equal(await (await fetch(reopened.src)).text(), "displayed-frame-crop-theme");
      assert.equal(f.ownedPNG.cloneOwnedPNGImage(inline), null, "retired images cannot be copied");
      f.disposePlugin(); await assert.rejects(fetch(reopened.src));
    } finally { f.close(); }
  }
});

test("loaded PNG URLs remain readable for independent pixel consumers", async () => {
  const f = await fixture();
  try {
    const img = new f.Image(),
      task = f.render(img);
    await flush();
    f.requests[0](blob("migrated"));
    await task;
    const first = img.src;
    img.fire("load");
    assert.equal(await (await fetch(first)).text(), "migrated");
    img.fire("error", false);
    assert.equal(await (await fetch(img.src)).text(), "migrated");
    assert.equal(
      f.requests.length,
      1,
      "pixel consumers reuse the payload without exporting again",
    );
    f.discard(img);
    await assert.rejects(fetch(first));
  } finally {
    f.close();
  }
});

test("concurrent cold PNG renders retain independent URLs until their images retire", async () => {
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
    assert.equal(await (await fetch(a.src)).text(), "first");
    const firstURL = a.src;
    f.discard(a);
    await assert.rejects(fetch(firstURL));
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
    assert.equal(await (await fetch(b.src)).text(), "cached");
    const remaining = b.src;
    f.discard(b);
    await assert.rejects(fetch(remaining));
  } finally {
    f.close();
  }
});

test("uncached PNG payloads release on discard or decode failure without populating the cache", async () => {
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
      const url = img.src;
      if (terminal === "load") {
        assert.equal(await (await fetch(url)).text(), terminal);
        f.discard(img);
      }
      await assert.rejects(fetch(url));
      assert.equal(await f.cache.getImageCacheData(f.key), undefined);
    } finally {
      f.close();
    }
  }
});

test("plugin retirement revokes PNG URLs and a stale disposer preserves its replacement", async () => {
  const f = await fixture();
  try {
    const img = new f.Image(),
      task = f.render(img);
    await flush();
    f.requests[0](blob("owned"));
    await task;
    img.fire("load");
    const url = img.src;
    f.disposePlugin();
    await assert.rejects(fetch(url));
    assert.equal(img.listeners.size, 0);
    const late = new f.Image();
    await f.render(late);
    assert.equal(late.src, "");
    const stale = f.ownedPNG.registerOwnedPNGImageSources();
    const current = f.ownedPNG.registerOwnedPNGImageSources();
    const replacement = new f.Image();
    await f.render(replacement);
    stale();
    assert.equal(await (await fetch(replacement.src)).text(), "owned");
    current();
    await assert.rejects(fetch(replacement.src));
    assert.equal(replacement.listeners.size, 0);
  } finally {
    f.close();
  }
});

test("discarding a pending PNG after cache shutdown still releases its URL and listeners", async () => {
  const f = await fixture();
  try {
    const img = new f.Image(),
      task = f.render(img);
    await flush();
    f.requests[0](blob("pending"));
    await task;
    const url = img.src;
    f.cache.destroy();
    f.discard(img);
    await assert.rejects(fetch(url));
    assert.equal(img.listeners.size, 0);
  } finally {
    f.close();
  }
});
