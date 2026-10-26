/** Exercise the real drop manager with browser/file payloads and conflicting action maps. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function fixture(payload, web = "image-url", local = "image-import", consume = false) {
  const calls = [], hooks = [];
  const fakeFile = { path: "/outside/picture.png", name: "picture.png", arrayBuffer: async () => new ArrayBuffer(1) };
  const transfer = { types: Object.keys(payload), getData: type => payload[type === "text" ? "text/plain" : type] ?? "", files: payload.Files ? [fakeFile] : [] };
  class TFile { constructor(path) { this.path = path; this.extension = path.split(".").at(-1); } }
  const ea = { destroy() {}, selectElementsInView() {}, addText: () => "text", getElement: () => ({}), addElementsToView: async () => true };
  const app = { dragManager: {}, workspace: { setActiveLeaf() {} }, metadataCache: { getFirstLinkpathDest: () => null, fileToLinktext: file => file.path } };
  const record = name => async (...args) => { calls.push([name, ...args]); };
  const div = { innerText: "", style: {}, clientWidth: 10 };
  const view = {
    app, plugin: { settings: { oEmbedAllowed: false } }, file: new TFile("drawing.md"), leaf: {},
    ownerDocument: { body: { appendChild() {}, removeChild() {} } },
    excalidrawAPI: { getAppState: () => ({ currentItemFontSize: 20 }) },
    getHookServer: () => ({ onDropHook: e => { hooks.push(e); return consume; } }),
    addImageWithURL: record("url"), addImageSaveToVault: record("import"), addYouTubeThumbnail: record("youtube"), addText: record("text"), save: async () => {},
  };
  const imageTypes = ["png"], animatedTypes = [];
  imageTypes.contains = imageTypes.includes; animatedTypes.contains = animatedTypes.includes;
  const dependencies = {
    obsidian: { TFile, Notice: class {} },
    "src/constants/constants": { DEVICE: {}, IMAGE_TYPES: imageTypes, ANIMATED_IMAGE_TYPES: animatedTypes, viewportCoordsToSceneCoords: () => ({ x: 1, y: 2 }), REG_LINKINDEX_INVALIDCHARS: /[?]/ },
    "src/utils/modifierkeyHelper": {
      internalDragModifierType: () => "link", webbrowserDragModifierType: () => web, localFileDragModifierType: () => local,
      modifierKeyTooltipMessages: () => ({ WebBrowserDragAction: { [web]: `web:${web}` }, LocalFileDragAction: { [local]: `local:${local}` } }),
    },
    "src/utils/utils": { hyperlinkIsImage: value => /\.png(?:[?#]|$)/.test(value), hyperlinkIsYouTubeLink: value => /youtube\.com\/watch/.test(value) },
    "src/core": { getEA: () => ea },
    "src/utils/excalidrawViewUtils": { insertEmbeddableToView: record("embed"), insertImageToView: record("file-image") },
    "src/utils/fileUtils": { getInternalLinkOrFileURLLink: path => ({ isInternal: false, url: `file://${path}` }), getURLImageExtension: () => "png", importFileToVault: async () => { calls.push(["file-import"]); return new TFile("picture.png"); } },
    "src/utils/styleUtils": { setStyle() {} },
  };
  const exports = {}, context = vm.createContext({ exports, require: name => dependencies[name] ?? {}, createDiv: () => div, getComputedStyle: () => ({ fontSize: "10" }) });
  vm.runInContext("Array.prototype.contains = Array.prototype.includes", context);
  vm.runInContext(ts.transpileModule(readFileSync(new URL("../../src/view/managers/DropManager.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  const manager = new exports.DropManager(view);
  const event = { dataTransfer: transfer, clientX: 1, clientY: 2, preventDefault() {} };
  return { manager, event, calls, hooks, app, TFile, div };
}

const image = "https://example.com/picture.png", video = "https://www.youtube.com/watch?v=abc123";
for (const payload of [
  { "text/plain": image }, { "text/html": `<img src="${image}">` }, { "text/uri-list": `# source\r\n${image}\r\n` },
  { Files: true, "text/plain": image }, { Files: true, "text/html": `<img src="${image}">` }, { Files: true, "text/uri-list": image },
]) {
  for (const [action, operation] of [["image-url", "url"], ["image-import", "import"], ["link", "text"]]) {
    test(`${Object.keys(payload).join("+")}: ${action} uses the web operation`, () => {
      const f = fixture(payload, action, action === "image-import" ? "image-url" : "image-import");
      assert.equal(f.manager.onDrop(f.event), false);
      assert.deepEqual(f.calls, [[operation, image]]);
      assert.equal(f.hooks.length, 1);
    });
  }
}

for (const action of ["image-url", "image-import"]) {
  test(`mixed YouTube thumbnail: ${action} retains the source page`, () => {
    const f = fixture({ Files: true, "text/html": `<img src="${image}">`, "text/uri-list": video }, action);
    f.manager.onDrop(f.event);
    assert.deepEqual(f.calls, [["youtube", video, ...(action === "image-import" ? [true] : [])]]);
  });
}

test("mixed embeddable is handled once; URL-only embeddable delegates to Excalidraw", async () => {
  const f = fixture({ Files: true, "text/plain": "https://example.com/page" }, "embeddable");
  assert.equal(f.manager.onDrop(f.event), false);
  assert.equal(f.calls[0][0], "embed");
  const plain = fixture({ "text/plain": "https://example.com/page" }, "embeddable");
  assert.equal(plain.manager.onDrop(plain.event), true);
  assert.equal(plain.calls.length, 0);
});

test("hook consumption prevents both insertion and local fallback", () => {
  const f = fixture({ Files: true, "text/plain": image }, "image-import", "image-url", true);
  assert.equal(f.manager.onDrop(f.event), false);
  assert.equal(f.calls.length, 0); assert.equal(f.hooks.length, 1);
});

test("pure OS files and mixed payloads without a URL retain the local import path", async () => {
  for (const payload of [{ Files: true }, { Files: true, "text/plain": "/outside/picture.png" }]) {
    const f = fixture(payload);
    assert.equal(f.manager.onDrop(f.event), false);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.calls.map(call => call[0]), ["file-import", "file-image"]);
  }
});

test("URI-only drags are accepted; mixed browser tooltip selects the web action", () => {
  const f = fixture({ Files: true, "text/uri-list": image }, "image-import");
  f.manager.onDragOver(f.event);
  assert.ok(f.div.innerText.startsWith("web:image-import"));
  assert.equal(f.manager.dropAction({ types: ["text/uri-list"] }), "copy");
});

test("internal vault drag wins over browser payload", () => {
  const f = fixture({ Files: true, "text/plain": image });
  f.app.dragManager.draggable = { type: "file", file: new f.TFile("inside.png") };
  f.manager.onDrop(f.event);
  assert.equal(f.hooks[0].type, "file");
  assert.equal(f.calls[0][0], "text");
});

test("YouTube import writes the thumbnail and keeps the video navigation link", async () => {
  const path = new URL("../../src/view/ExcalidrawView.ts", import.meta.url);
  const source = readFileSync(path, "utf8"), tree = ts.createSourceFile(path.pathname, source, ts.ScriptTarget.Latest, true);
  const viewClass = tree.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "ExcalidrawView");
  const methods = viewClass.members.filter(node => ["addYouTubeThumbnail", "addImageSaveToVault"].includes(node.name?.getText(tree))).map(node => node.getText(tree));
  assert.equal(methods.length, 2);
  const inserted = [], elements = {}, vaultFile = { path: "attachments/thumbnail.png" };
  const ea = {
    addImage: async (_x, _y, source) => { inserted.push(source); elements.image = {}; return "image"; },
    getElement: id => elements[id], addElementsToView: async () => {}, destroy() {},
  };
  const exports = {};
  const code = ts.transpileModule(`export class ImportHarness { ${methods.join("\n")} }`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, {
    exports, getEA: () => ea, getYouTubeThumbnailLink: async () => image,
    getMimeType: () => "image/png", getURLImageExtension: () => "png", getDataURLFromURL: async () => "data:image/png;base64,fixture",
    generateIdFromFile: async () => "fixture", TextEncoder,
  });
  const harness = new exports.ImportHarness();
  harness.excalidrawData = { saveDataURLtoVault: async () => vaultFile };
  await harness.addYouTubeThumbnail(video, true);
  assert.deepEqual(inserted, [vaultFile]);
  assert.equal(elements.image.link, video);
  inserted.length = 0;
  await harness.addYouTubeThumbnail(video);
  assert.deepEqual(inserted, [image]);
  assert.equal(elements.image.link, video);
});
