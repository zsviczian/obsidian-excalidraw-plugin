/** Exercise the real postprocessor with deferred image generation, without Electron. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = resolve(import.meta.dirname, "../..");
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function fixture() {
  const observers = [], timers = new Map(), intervals = new Map(), jobs = [], requests = [], errors = [], released = [], loaders = [];
  let timerId = 0;
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(el) { this.el = el; this.connected = true; }
    disconnect() { this.connected = false; }
    fire(...attributes) {
      if (this.connected) this.callback(attributes.map(attributeName => ({ attributeName })));
    }
  }
  const ownerWindow = {
    MutationObserver: Observer,
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: id => timers.delete(id),
    setInterval: callback => { intervals.set(++timerId, callback); return timerId; },
    clearInterval: id => intervals.delete(id),
  };
  class Element {
    constructor(classes = "", tag = "div") {
      this.classes = new Set(classes.split(" "));
      this.tag = tag; this.attrs = new Map(); this.children = []; this.isConnected = true;
      this.ownerDocument = { defaultView: ownerWindow };
      this.ownerDocument.body = { querySelectorAll: () => [] };
    }
    hasClass(cls) { return this.classes.has(cls); }
    addClass(cls) { this.classes.add(cls); }
    removeClass(cls) { this.classes.delete(cls); }
    getAttribute(key) { return this.attrs.get(key) ?? null; }
    setAttribute(key, value) { this.attrs.set(key, value); }
    removeAttribute(key) { this.attrs.delete(key); }
    hasAttribute(key) { return this.attrs.has(key); }
    get firstElementChild() { return this.children[0] ?? null; }
    hasChildNodes() { return this.children.length > 0; }
    closest(selector) {
      let el = this;
      while (el) { if (selector.startsWith(".") && el.hasClass(selector.slice(1))) return el; el = el.parentElement; }
      return null;
    }
    empty() { for (const child of this.children) child.parentElement = null; this.children = []; }
    appendChild(child) { this.children.push(child); child.parentElement = this; return child; }
    replaceChild(child, old) {
      const index = this.children.indexOf(old); assert.notEqual(index, -1);
      this.children[index] = child; child.parentElement = this; old.parentElement = null;
    }
    querySelectorAll(selector) {
      return this.children.flatMap(child => [...(selector === child.tag || (selector.startsWith(".") && child.hasClass(selector.slice(1))) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  }
  class RenderChild {
    constructor(containerEl) { this.containerEl = containerEl; this.cleanups = []; this._loaded = false; }
    register(callback) { this.cleanups.push(callback); }
    load() { if (!this._loaded) { this._loaded = true; this.onload(); } }
    unload() {
      if (!this._loaded) return;
      this._loaded = false;
      for (const callback of this.cleanups.splice(0).reverse()) callback();
      this.onunload();
    }
  }
  class TFile { constructor(path) { this.path = path; this.extension = path.split(".").at(-1); } }
  const sourceFile = new TFile("source.excalidraw.md"), targetFile = new TFile("target.excalidraw.md");
  const plainFile = new TFile("image.png");
  const files = new Map([sourceFile, targetFile, plainFile].map(file => [file.path, file]));
  const frontmatters = new Map();
  const plugin = {
    _loaded: true,
    awaitInit: async () => {},
    awaitSettings: async () => {},
    settings: { width: "400", height: "", renderImageInMarkdownReadingMode: true, renderImageInMarkdownToPDF: true },
    isExcalidrawFile: file => file.path.endsWith("excalidraw.md"),
    app: {
      vault: { getAbstractFileByPath: path => files.get(path), getFileByPath: path => files.get(path) },
      metadataCache: { getFirstLinkpathDest: path => files.get(path), getFileCache: file => ({ frontmatter: frontmatters.get(file.path) }) },
    },
  };
  const queue = { addTask: task => new Promise((resolve, reject) => jobs.push(async () => { try { await task(); resolve(); } catch (e) { reject(e); } })) };
  const image = (name = "result") => {
    const div = new Element(), img = new Element("", "img"); img.src = `blob:${name}`; div.appendChild(img); return div;
  };
  const createImage = async (attr, onCanvas, embedEl, isRenderActive) => {
    const result = deferred(); requests.push({ ...result, attr, isRenderActive }); return result.promise;
  };
  const mocks = {
    obsidian: { TFile, MarkdownRenderChild: RenderChild },
    "src/shared/GlobalTaskQueue": { getGlobalTaskQueue: () => queue },
    "../../utils/debugHelper": { DEBUGGING: false },
    "../../shared/ImageCache": { getImageCache: () => ({ isReady: () => false, releaseObsidianURL: url => released.push(url) }) },
    "../../shared/EmbeddedFileLoader": { EmbeddedFilesLoader: class { constructor() { this.terminate = false; loaders.push(this); } } },
    "../../types/utilTypes": { PreviewImageType: { PNG: "PNG", SVGIMG: "SVGIMG", SVG: "SVG" } },
    "../../utils/typechecks": { isInstanceOfHTMLImageElement: el => el.tag === "img" },
    "../../utils/obsidianUtils": { getSafeFrontmatter: fm => fm ?? {}, getParentOfClass: () => null },
    "src/utils/htmlUtils": { setElementDisplay: (el, display) => { if (display === "none") el.addClass("excalidraw-display-none"); else el.removeClass("excalidraw-display-none"); } },
    "../../utils/utils": {
      hasExportTheme: () => false, getWithBackground: () => false, isMaskFile: () => false,
      getEmbeddedFilenameParts: src => ({ hasBlockref: src.includes("#^"), blockref: src.split("#^")[1] }),
    },
  };
  const context = vm.createContext({ MutationObserver: Observer, window: ownerWindow, createEl: tag => new Element("", tag),
    console: { error: (...args) => errors.push(args) }, __createImage: createImage, __createRaster: async () => null });
  const compile = (source, require) => {
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    vm.runInContext(`(function(require,exports){${code}\n})`, context)(require, exports);
    return exports;
  };
  const child = compile(readFileSync(resolve(root, "src/core/managers/MarkdownEmbedRenderChild.ts"), "utf8"), name => mocks[name]);
  Object.assign(mocks["../../utils/utils"], compile(readFileSync(resolve(root, "src/utils/embeddedFilenameParts.ts"), "utf8"), () => ({})));
  let source = readFileSync(resolve(root, "src/core/managers/MarkdownPostProcessor.ts"), "utf8");
  // Stub only image generation. Routing, cleanup, queueing and lifecycle are production code.
  const tree = ts.createSourceFile("processor.ts", source, ts.ScriptTarget.Latest, true);
  const seams = { createImageDiv: "globalThis.__createImage", _getPNG: "globalThis.__createRaster", setImgStyle: "() => {}" };
  const statements = tree.statements.filter(s => ts.isVariableStatement(s) && s.declarationList.declarations.some(d => Object.hasOwn(seams, d.name.getText(tree))));
  assert.equal(statements.length, 3, "image generation seams exist");
  for (const statement of statements.reverse()) {
    const name = statement.declarationList.declarations[0].name.getText(tree);
    source = source.slice(0, statement.getStart(tree)) + `const ${name} = ${seams[name]};` + source.slice(statement.end);
  }
  source += "\nexport { tmpObsidianWYSIWYG, processReadingMode, getIMG };";
  const processor = compile(source, name => name === "./MarkdownEmbedRenderChild" ? child : mocks[name] ?? {});
  processor.initializeMarkdownPostProcessor(plugin);
  const container = new Element("internal-embed markdown-embed"); container.setAttribute("src", targetFile.path);
  const el = container.appendChild(new Element());
  const children = [];
  const ctx = { sourcePath: sourceFile.path, containerEl: container, remainingNestLevel: 5, addChild: c => { children.push(c); c.load(); } };
  const render = () => processor.tmpObsidianWYSIWYG(el, ctx, false, false, false);
  const flushTimers = () => { for (const [id, callback] of timers) { timers.delete(id); callback(); } };
  const start = () => { assert.ok(jobs.length); const done = jobs.shift()(); return done; };
  const settle = async (name = "result", request = requests.at(-1)) => { const result = image(name); request.resolve(result); await Promise.resolve(); return result; };
  return { processor, plugin, container, ctx, el, children, render, jobs, requests, errors, released, observers, timers, intervals, loaders, frontmatters, flushTimers, start, settle, image, Element };
}

test("ready follows successful insertion; repeated callbacks preserve the image", async () => {
  const f = fixture(); const first = f.render(); const repeat = f.render();
  assert.equal(f.container.hasAttribute("ready"), false); assert.equal(f.jobs.length, 1); assert.equal(f.children.length, 1);
  const job = f.start(); const result = await f.settle(); await job; await Promise.all([first, repeat]);
  assert.equal(f.container.children[0], result); assert.equal(f.container.hasAttribute("ready"), true);
  await f.render(); assert.equal(f.container.children[0], result); assert.equal(f.jobs.length, 0);
});

for (const phase of ["before queue start", "during image generation"]) {
  test(`a live, detached context recovers on reattachment (${phase})`, async () => {
    const f = fixture(); const rendered = f.render();
    if (phase === "before queue start") f.container.isConnected = false;
    const job = f.start(); f.container.isConnected = false;
    assert.equal(f.requests[0].isRenderActive(), true, "embedded-file loading survives a temporary detach");
    const result = await f.settle(); await job; await rendered;
    f.container.isConnected = true; await f.render();
    assert.equal(f.container.children[0], result); assert.equal(f.container.hasAttribute("ready"), true);
    assert.equal(f.requests.length, 1); assert.equal(f.released.includes("blob:result"), false);
  });
}

for (const failure of ["null", "throw"]) {
  test(`${failure} releases pending state and allows a later callback to retry`, async () => {
    const f = fixture(); const rendered = f.render(); const job = f.start();
    if (failure === "null") f.requests[0].resolve(null); else f.requests[0].reject(Error("expected fixture failure"));
    await job; await rendered; assert.equal(f.container.hasAttribute("ready"), false);
    const retry = f.render(); const secondJob = f.start(); const result = await f.settle("retry"); await secondJob; await retry;
    assert.equal(f.container.children[0], result); assert.equal(f.errors.length, failure === "throw" ? 1 : 0);
  });
}

test("an obsolete completion cannot insert or clear a newer pending attempt", async () => {
  const f = fixture(); const first = f.render(); const oldJob = f.start();
  f.observers.find(o => o.el === f.container).fire("class", "width"); f.flushTimers();
  const newJob = f.start(); assert.equal(f.requests.length, 2);
  await f.settle("obsolete", f.requests[0]); await oldJob; await first;
  const repeat = f.render(); assert.equal(f.jobs.length, 0);
  const result = await f.settle("current", f.requests[1]); await newJob; await repeat;
  assert.equal(f.container.children[0], result); assert.ok(f.released.includes("blob:obsolete"));
  assert.equal(f.container.hasAttribute("ready"), true);
});

test("attribute refresh retains the current image and the actual target until replacement", async () => {
  const f = fixture(); const first = f.render(); const job = f.start(); const result = await f.settle(); await job; await first;
  f.container.setAttribute("width", "123"); f.observers.find(o => o.el === f.container).fire("width"); f.flushTimers();
  const refresh = f.start(); assert.equal(f.container.children[0], result);
  assert.equal(f.requests[1].attr.file.path, "target.excalidraw.md"); assert.equal(f.requests[1].attr.fwidth, "123");
  const replacement = await f.settle("resized"); await refresh;
  assert.equal(f.container.children[0], replacement); assert.ok(f.released.includes("blob:result"));
});

test("a later callback repairs content removed by the host", async () => {
  const f = fixture(); const first = f.render(); const job = f.start(); await f.settle(); await job; await first;
  f.container.empty();
  const retry = f.render(); const next = f.start(); const result = await f.settle("restored"); await next; await retry;
  assert.equal(f.container.children[0], result); assert.equal(f.container.hasAttribute("ready"), true);
});

test("an unloaded context cannot overwrite a replacement context's image", async () => {
  const f = fixture(); const first = f.render(); const oldJob = f.start(); f.children[0].unload();
  const second = f.render(); const newJob = f.start(); const result = await f.settle("new-context", f.requests[1]); await newJob; await second;
  await f.settle("old-context", f.requests[0]); await oldJob; await first;
  assert.equal(f.container.children[0], result); assert.equal(f.container.hasAttribute("ready"), true);
  assert.ok(f.released.includes("blob:old-context")); assert.equal(f.children.length, 2);
});

test("plugin unload cancels an in-flight image", async () => {
  const f = fixture(); const rendered = f.render(); const job = f.start(); f.plugin._loaded = false;
  await f.settle("plugin-unloaded"); await job; await rendered;
  assert.equal(f.container.children.length, 0); assert.equal(f.container.hasAttribute("ready"), false);
  assert.ok(f.released.includes("blob:plugin-unloaded"));
});

for (const phase of ["queued", "generating", "debounced"]) {
  test(`permanent unload stops ${phase} work and cleans observers/timers`, async () => {
    const f = fixture(); const rendered = f.render();
    const job = phase === "queued" ? null : f.start();
    if (phase === "debounced") f.observers.find(o => o.el === f.container).fire("height");
    f.children[0].unload(); f.container.isConnected = false;
    if (job) assert.equal(f.requests[0].isRenderActive(), false, "embedded-file loading stops on unload");
    if (job) await f.settle("cancelled");
    await (job ?? f.start()); await rendered; f.flushTimers();
    assert.equal(f.container.children.length, 0); assert.equal(f.container.hasAttribute("ready"), false);
    assert.equal(f.timers.size, 0); assert.equal(f.observers.some(o => o.connected), false);
    if (job) assert.ok(f.released.includes("blob:cancelled")); else assert.equal(f.requests.length, 0);
  });
}

test("ordinary image embeds, text references and code blocks remain native", async () => {
  for (const kind of ["image.png", "target.excalidraw.md#^text", "code"]) {
    const f = fixture();
    if (kind === "code") { f.container.classes = new Set(["cm-embed-block"]); }
    else f.container.setAttribute("src", kind);
    await f.render(); assert.equal(f.container.children[0], f.el); assert.equal(f.children.length, 0); assert.equal(f.jobs.length, 0);
  }
});

test("Reading mode skips a detached candidate without suppressing a later live drawing", async () => {
  const f = fixture(); const detached = new f.Element(); detached.isConnected = false;
  const parent = new f.Element(), live = parent.appendChild(new f.Element("internal-embed")); live.setAttribute("src", "target.excalidraw.md");
  const rendered = f.processor.processReadingMode([detached, live], f.ctx);
  assert.equal(f.jobs.length, 1); const job = f.start(); const result = await f.settle(); await job; await rendered;
  assert.equal(parent.children[0], result);
});

test("image loader cancellation follows context lifetime and always clears its interval", async () => {
  for (const alive of [true, false]) {
    const f = fixture(); const init = deferred(); f.plugin.awaitInit = () => init.promise;
    f.plugin.settings.previewImageType = "PNG"; f.container.isConnected = false;
    const result = f.processor.getIMG({ file: { path: "target.excalidraw.md" }, fname: "target.excalidraw.md", imgstyle: [] }, false, f.container, () => alive);
    assert.equal(f.intervals.size, 1);
    for (const callback of f.intervals.values()) callback();
    assert.equal(f.loaders[0].terminate, !alive);
    init.resolve(); await result; assert.equal(f.intervals.size, 0);
  }
});

test("explicit self-images override Markdown preferences and use the containing drawing", async () => {
  for (const property of ["excalidraw-open-md", "excalidraw-embed-md"]) {
    const f = fixture(); f.ctx.frontmatter = { [property]: true }; f.frontmatters.set(f.ctx.sourcePath, f.ctx.frontmatter);
    f.container.setAttribute("src", "#^as-image");
    const rendered = f.render(); const job = f.start();
    assert.equal(f.requests[0].attr.fname, `${f.ctx.sourcePath}#^as-image`);
    await f.settle(); await job; await rendered;
    assert.equal(f.container.hasAttribute("ready"), true);
  }
});

test("Reading mode resolves explicit self-images, but ignores empty and ordinary text fragments", async () => {
  for (const src of ["#^as-image", "", "#", "#^", "#Heading", "#^real-block"]) {
    const f = fixture(); const parent = new f.Element(); const embed = parent.appendChild(new f.Element("internal-embed")); embed.setAttribute("src", src);
    const rendered = f.processor.processReadingMode([embed], f.ctx);
    if (src === "#^as-image") {
      const job = f.start(); assert.equal(f.requests[0].attr.fname, `${f.ctx.sourcePath}#^as-image`);
      const result = await f.settle(); await job; await rendered; assert.equal(parent.children[0], result);
    } else { await rendered; assert.equal(f.jobs.length, 0); assert.equal(parent.children[0], embed); }
  }
});

test("Reading mode preserves a target's Markdown side unless the link explicitly requests an image", async () => {
  for (const property of ["excalidraw-open-md", "excalidraw-embed-md"]) {
    for (const suffix of ["", "#^as-image"]) {
      const f = fixture(); const parent = new f.Element(); const embed = parent.appendChild(new f.Element("internal-embed")); embed.setAttribute("src", `target.excalidraw.md${suffix}`);
      f.frontmatters.set("target.excalidraw.md", { [property]: true });
      const rendered = f.processor.processReadingMode([embed], f.ctx);
      if (suffix) { const job = f.start(); await f.settle(); await job; await rendered; assert.notEqual(parent.children[0], embed); }
      else { await rendered; assert.equal(f.jobs.length, 0); assert.equal(parent.children[0], embed); }
    }
  }
});

test("nested Markdown-side drawings and PNGs remain visible; drawing metadata stays hidden", async () => {
  for (const property of ["excalidraw-open-md", "excalidraw-embed-md", null]) {
    for (const src of ["target.excalidraw.md", "image.png", "#^as-image"]) {
      const f = fixture(); f.ctx.frontmatter = { "excalidraw-plugin": "parsed", ...(property ? { [property]: true } : {}) };
      f.frontmatters.set(f.ctx.sourcePath, f.ctx.frontmatter);
      const section = new f.Element("el-p excalidraw-display-none"); const embed = section.appendChild(new f.Element("internal-embed")); embed.setAttribute("src", src);
      const rendered = f.processor.markdownPostProcessor(section, f.ctx); await new Promise(resolve => setImmediate(resolve));
      if (property && src !== "image.png") { const job = f.start(); await f.settle(); await job; }
      await rendered;
      assert.equal(section.hasClass("excalidraw-display-none"), !property);
      if (property && src === "image.png") assert.equal(section.children[0], embed);
    }
  }
});
