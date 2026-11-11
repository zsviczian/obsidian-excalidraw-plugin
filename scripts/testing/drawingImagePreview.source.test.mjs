import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { sourceHarness } from "./sourceHarness.mjs";

function productionScale() {
  const compile = (path, dependencies = {}) => {
    const source = readFileSync(new URL("../../" + path, import.meta.url), "utf8"), exports = {};
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, require: name => dependencies[name] ?? {}, Date }); return exports;
  };
  return compile("src/utils/utils.ts", {
    "../constants/constants": { EXCALIDRAW_PLUGIN: null, mutateElement: (el, _map, patch) => Object.assign(el, patch) },
    "./elementCustomDataUtils": compile("src/utils/elementCustomDataUtils.ts"),
    "./collectionUtils": { arrayToMap: elements => new Map(elements.map(el => [el.id, el])) },
    "src/types/markdownImageTypes": { MARKDOWN_IMAGE_CUSTOM_DATA_KEY: "markdownImage" },
    "roughjs/bin/math": { Random: class {} },
  }).scaleLoadedImage;
}

async function fixture() {
  const prompts = [], errors = [], notices = [], renders = [], history = [], registry = new Map(), payloads = [];
  const file = { path: "Host.md" }, drawing = { path: "Source.md", basename: "Source <drawing>" };
  const graph = sourceHarness({ obsidian: { Notice: class { constructor(value) { notices.push(value); } }, parseYaml: () => ({}) },
    "src/constants/constants": { CaptureUpdateAction: { IMMEDIATELY: "IMMEDIATELY" }, fileid: () => "new-" + registry.size + "-" + renders.length },
    "src/shared/Dialogs/DrawingImagePreviewPopover": { DrawingImagePreviewPopover: class {} },
    "src/lang/helpers": { t: key => key === "PREVIEW_SHARED_HELP" ? '“{drawing}” appears in {count} images in this scene.' : key },
    "src/utils/coreUtils": { errorlog: error => errors.push(error) },
  });
  const { DrawingImagePreviewController } = await graph.importModule("src/view/managers/DrawingImagePreviewController.ts");
  const { getDrawingPreviewParts } = await graph.importModule("src/utils/drawingPreviewLink.ts");
  class Descriptor {
    file = drawing; isMarkdownSection = false; colorMap = null;
    constructor(_plugin, _host, link) { this.linkParts = { original: link }; }
    shouldScale() { return !this.linkParts.original.endsWith("|100%"); }
    setImage(image) { this.image = image; }
  }
  class Loader {
    async getObsidianImage(descriptor) {
      renders.push(descriptor.linkParts.original); if (pause) await pause;
      const parts = getDrawingPreviewParts(descriptor.linkParts.original), p = parts.padding ?? 0;
      const size = parts.blockref === "tall" ? { width: 100 + 2*p, height: 300 + 2*p } : { width: 300 + 2*p, height: 100 + 2*p };
      return { fileId: "generated", mimeType: "image/svg+xml", dataURL: "data:image/svg+xml;base64,AA==", created: 1, hasSVGwithBitmap: false, size };
    }
  }
  class Prompt {
    titleEl = { setText() {} };
    constructor(_plugin, message, buttons) { this.message = message; this.buttons = buttons; this.waitForClose = new Promise(resolve => { this.choose = resolve; }); prompts.push(this); }
    close() { this.choose(null); }
  }
  const source = new Descriptor(null, null, "Source.md"); registry.set("shared", source);
  registry.set("other", new Descriptor(null, null, "Source.md#^frame=tall,padding=20|100%"));
  const image = (id, fileId, x, width, height) => ({ id, fileId, type: "image", x, y: 10, width, height, version: 1, versionNonce: 1, customData: { retained: true }, crop: null });
  let elements = [image("one", "shared", 0, 300, 100), image("two", "shared", 400, 150, 50), image("three", "other", 650, 100, 300)], alive = true, pause;
  const api = { getAppState: () => ({ theme: "light" }), addFiles: data => payloads.push(data) };
  const view = { file, excalidrawAPI: api, plugin: { _loaded: true, isExcalidrawFile: candidate => candidate === drawing },
    excalidrawData: { getFile: id => registry.get(id), setFile: (id, value) => registry.set(id, value) },
    getViewElements: () => elements, updateScene: update => { history.push(elements); elements = update.elements; }, setDirty() {},
  };
  const controller = new DrawingImagePreviewController(view, { Prompt, EmbeddedFile: Descriptor, EmbeddedFilesLoader: Loader, scaleLoadedImage: productionScale() });
  return { controller, source, view, prompts, errors, notices, renders, registry, payloads, elements: () => elements,
    async apply(changes, choice = "one") { const result = controller.apply("one", source, changes, () => alive); prompts.at(-1).choose(choice); return await result; },
    undo() { elements = history.pop(); }, retire() { alive = false; controller.reset(); },
    pause() { let resume; pause = new Promise(resolve => { resume = resolve; }); return resume; },
    changeTarget() { elements = elements.map(el => el.id === "one" ? { ...el, version: 10 } : el); },
    close() { controller.reset(); graph.close(); },
  };
}

test("only this image gets a new persisted link and uses real external-update geometry; undo retains the original reference", async () => {
  const f = await fixture();
  try {
    assert.equal(await f.apply({ frame: "tall", padding: 30 }), true);
    const [one, two, three] = f.elements();
    assert.notEqual(one.fileId, "shared"); assert.equal(two.fileId, "shared"); assert.equal(three.fileId, "other");
    assert.equal(f.registry.get(one.fileId).linkParts.original, "Source.md#^frame=tall,padding=30");
    assert.ok(Math.abs(one.width * one.height - 30000) < .001); assert.equal(one.x + one.width/2, 150); assert.equal(one.y + one.height/2, 60);
    assert.equal(one.customData.retained, true); assert.equal(f.payloads.length, 1);
    assert.match(f.prompts[0].message, /Source &lt;drawing&gt;/); assert.doesNotMatch(f.prompts[0].message, /fileId|shared/);
    f.undo(); assert.equal(f.elements()[0].fileId, "shared"); assert.equal(f.registry.get("shared").linkParts.original, "Source.md");
  } finally { f.close(); }
});

test("apply to all copies changes only edited fields, preserving distinct views, anchoring and each image center", async () => {
  const f = await fixture();
  try {
    const old = f.elements().map(el => ({ center: [el.x+el.width/2,el.y+el.height/2], area: el.width*el.height }));
    assert.equal(await f.apply({ padding: 50 }, "all"), true);
    const elements = f.elements(); assert.equal(elements[0].fileId, elements[1].fileId);
    assert.equal(f.registry.get(elements[0].fileId).linkParts.original, "Source.md#^as-image,padding=50");
    assert.equal(f.registry.get(elements[2].fileId).linkParts.original, "Source.md#^frame=tall,padding=50|100%");
    for (let i=0;i<3;i++) { const el=elements[i]; assert.deepEqual([el.x+el.width/2,el.y+el.height/2],old[i].center); if(i<2)assert.ok(Math.abs(el.width*el.height-old[i].area)<.001); }
    assert.equal(elements[2].width, 200); assert.equal(elements[2].height, 400); assert.equal(elements[2].customData.isAnchored, true);
  } finally { f.close(); }
});

test("100% anchoring follows rendered intrinsic dimensions and remains in the link", async () => {
  const f = await fixture();
  try { assert.equal(await f.apply({ anchored: true }), true); const el=f.elements()[0];
    assert.equal(f.registry.get(el.fileId).linkParts.original, "Source.md|100%"); assert.equal(el.width,300); assert.equal(el.height,100); assert.equal(el.customData.isAnchored,true);
  } finally { f.close(); }
});

test("cancel, stale scene changes and retired views do not register partial links or write a scene", async () => {
  for (const kind of ["cancel", "changed", "retired"]) {
    const f=await fixture();
    try {
      if(kind==='cancel')assert.equal(await f.apply({padding:20},null),false);
      else {const resume=f.pause(), pending=f.apply({padding:20}); await new Promise(resolve=>setImmediate(resolve));
        if(kind==='changed')f.changeTarget();else f.retire(); resume(); assert.equal(await pending,false);}
      assert.equal(f.registry.size,2); assert.equal(f.payloads.length,0); assert.equal(f.elements()[0].fileId,'shared');
    } finally {f.close();}
  }
});
