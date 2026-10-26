/** Exercise the real drop manager with browser/file payloads and conflicting action maps. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Keep URL recognition identical to production (including unsupported blob and
// extensionless URLs). A permissive .png-only mock hid these regressions.
const utilsPath = new URL("../../src/utils/utils.ts", import.meta.url);
const utilsSource = readFileSync(utilsPath, "utf8");
const utilsTree = ts.createSourceFile(utilsPath.pathname, utilsSource, ts.ScriptTarget.Latest, true);
const urlFunctions = utilsTree.statements.filter(node => ts.isFunctionDeclaration(node) &&
  ["isHyperLink", "hyperlinkIsImage", "hyperlinkIsYouTubeLink"].includes(node.name?.text)).map(node => node.getText(utilsTree)).join("\n");
const constantsPath = new URL("../../src/constants/constants.ts", import.meta.url);
const constantsSource = readFileSync(constantsPath, "utf8");
const constantsTree = ts.createSourceFile(constantsPath.pathname, constantsSource, ts.ScriptTarget.Latest, true);
const imageTypesNode = constantsTree.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
  .find(node => node.name.getText(constantsTree) === "IMAGE_TYPES");
const imageTypes = vm.runInNewContext(imageTypesNode.initializer.getText(constantsTree));
imageTypes.contains = imageTypes.includes;
const animatedTypesNode = constantsTree.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
  .find(node => node.name.getText(constantsTree) === "ANIMATED_IMAGE_TYPES");
const animatedTypes = vm.runInNewContext(animatedTypesNode.initializer.getText(constantsTree));
animatedTypes.contains = animatedTypes.includes;
const fileUtilsPath = new URL("../../src/utils/fileUtils.ts", import.meta.url);
const fileUtilsTree = ts.createSourceFile(fileUtilsPath.pathname, readFileSync(fileUtilsPath, "utf8"), ts.ScriptTarget.Latest, true);
const extensionNode = fileUtilsTree.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
  .find(node => node.name.getText(fileUtilsTree) === "getURLImageExtension");
const getURLImageExtension = vm.runInNewContext(ts.transpileModule(`(${extensionNode.initializer.getText(fileUtilsTree)})`, {}).outputText);
const productionURLs = {};
vm.runInNewContext(ts.transpileModule(urlFunctions, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports: productionURLs, IMAGE_TYPES: imageTypes,
  URLs: { YOUTU_BE: "https://youtu.be", WWW_YOUTUBE_COM: "https://www.youtube.com", YOUTUBE_COM: "https://youtube.com" },
});

const settingsPath = new URL("../../src/core/settingsDefaults.ts", import.meta.url);
const settingsTree = ts.createSourceFile(settingsPath.pathname, readFileSync(settingsPath, "utf8"), ts.ScriptTarget.Latest, true);
const defaultsNode = settingsTree.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
  .find(node => node.name.getText(settingsTree) === "DEFAULT_SETTINGS");
const modifierConfigNode = defaultsNode.initializer.properties.find(node => node.name?.getText(settingsTree) === "modifierKeyConfig");
const modifierSource = ts.transpileModule(readFileSync(new URL("../../src/utils/modifierkeyHelper.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function productionModifiers(platform) {
  const exports = {};
  const settings = { modifierKeyConfig: vm.runInNewContext(`(${modifierConfigNode.initializer.getText(settingsTree)})`) };
  vm.runInNewContext(modifierSource, {
    exports, window: { ExcalidrawAutomate: { plugin: { settings } } },
    require: name => name === "src/constants/constants" ? { DEVICE: { isMacOS: platform === "Mac" } }
      : name === "src/lang/helpers" ? { t: key => key } : {},
  });
  return exports;
}

const embeddablePath = new URL("../../src/utils/customEmbeddableUtils.ts", import.meta.url);
const embeddableTree = ts.createSourceFile(embeddablePath.pathname, readFileSync(embeddablePath, "utf8"), ts.ScriptTarget.Latest, true);
const predictNode = embeddableTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "predictViewType");
const embeddableHelpers = {};
const constantArray = name => {
  const node = constantsTree.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
    .find(node => node.name.getText(constantsTree) === name);
  const values = vm.runInNewContext(node.initializer.getText(constantsTree));
  values.contains = values.includes;
  return values;
};
vm.runInNewContext(ts.transpileModule(predictNode.getText(embeddableTree), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports: embeddableHelpers, AUDIO_TYPES: constantArray("AUDIO_TYPES"), VIDEO_TYPES: constantArray("VIDEO_TYPES"), log() {},
});

function fixture(payload, web = "image-url", local = "image-import", consume = false, options = {}) {
  const calls = [], hooks = [];
  const fakeFile = { path: "/outside/picture.png", name: "picture.png", type: "image/png", arrayBuffer: async () => new ArrayBuffer(1), ...options.file };
  const transfer = { types: Object.keys(payload), getData: type => payload[type === "text" ? "text/plain" : type] ?? "", files: payload.Files ? [fakeFile] : [] };
  class TFile { constructor(path) { this.path = path; this.extension = path.split(".").at(-1); } }
  const ea = { canvas: {}, destroy() {}, selectElementsInView() {}, addText: (...args) => { calls.push(["ea-text", ...args]); return "text"; }, addImage: async (...args) => { calls.push(["ea-image", ...args]); return "image"; }, getElement: () => ({}), addElementsToView: async () => true };
  const app = { dragManager: {}, workspace: { setActiveLeaf() {} }, viewRegistry: { getTypeByExtension: ext => options.viewTypes?.[ext] }, metadataCache: { getFirstLinkpathDest: () => options.duplicate ? new TFile("existing/picture.png") : null, fileToLinktext: file => file.path }, vault: { modifyBinary: async file => calls.push(["overwrite", file.path]) } };
  const record = name => async (...args) => { calls.push([name, ...args]); };
  const div = { innerText: "", style: {}, clientWidth: 10 };
  const view = {
    app, plugin: { settings: { oEmbedAllowed: false } }, file: new TFile("drawing.md"), leaf: {},
    ownerDocument: { body: { appendChild() {}, removeChild() {} } },
    excalidrawAPI: { getAppState: () => ({ currentItemFontSize: 20 }) },
    getHookServer: () => ({ onDropHook: e => { hooks.push(e); return consume; } }),
    addImageWithURL: record("url"), addImageSaveToVault: record("import"), addYouTubeThumbnail: record("youtube"), addText: record("text"), save: async () => {},
  };
  const dependencies = {
    obsidian: { TFile, Notice: class {} },
    "src/constants/constants": { DEVICE: {}, IMAGE_TYPES: imageTypes, ANIMATED_IMAGE_TYPES: animatedTypes, viewportCoordsToSceneCoords: () => ({ x: 1, y: 2 }), REG_LINKINDEX_INVALIDCHARS: /[?]/ },
    "src/utils/modifierkeyHelper": options.platform ? productionModifiers(options.platform) : {
      internalDragModifierType: () => "link", webbrowserDragModifierType: () => web, localFileDragModifierType: () => local,
      modifierKeyTooltipMessages: () => ({ WebBrowserDragAction: { [web]: `web:${web}` }, LocalFileDragAction: { [local]: `local:${local}` } }),
    },
    "src/utils/utils": productionURLs,
    "src/utils/customEmbeddableUtils": embeddableHelpers,
    "src/shared/Scripts": { ScriptEngine: { suggester: async () => { calls.push(["duplicate-choice", options.duplicate]); return options.duplicate; } } },
    "src/shared/Dialogs/UniversalInsertFileModal": { UniversalInsertFileModal: class { open(...args) { calls.push(["file-modal", ...args]); } } },
    "src/core": { getEA: () => ea },
    "src/utils/excalidrawViewUtils": { insertEmbeddableToView: record("embed"), insertImageToView: record("file-image") },
    "src/utils/fileUtils": { getInternalLinkOrFileURLLink: path => ({ isInternal: false, url: `file://${path}` }), getURLImageExtension, importFileToVault: async (_app, name) => { calls.push(["file-import"]); return new TFile(name); } },
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
const page = "https://example.com/article";
for (const source of ["https://example.com/render?id=1", "blob:https://example.com/image-id"]) {
  for (const action of ["image-url", "image-import"]) {
    test(`${source}: ${action} imports the supplied image without an OS path`, async () => {
      const f = fixture({ Files: true, "text/html": `<img src="${source}">`, "text/plain": source }, action, "link", false, { file: { path: undefined } });
      assert.equal(f.manager.onDrop(f.event), false);
      await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(f.calls.map(call => call[0]), ["file-import", "file-image"]);
      assert.equal(f.hooks.length, 1);
    });
  }
}
for (const sourcePage of [page, video]) {
  for (const action of ["image-url", "image-import", "link", "embeddable"]) {
    test(`linked image ${sourcePage}: ${action} chooses the correct target`, () => {
      const f = fixture({ Files: true, "text/html": `<a href="${sourcePage}"><img src="${image}"></a>`, "text/plain": sourcePage, "text/uri-list": sourcePage }, action);
      assert.equal(f.manager.onDrop(f.event), false);
      if (action === "link") assert.deepEqual(f.calls, [["text", sourcePage]]);
      else if (action === "embeddable") assert.equal(f.calls[0].at(-1), sourcePage);
      else if (sourcePage === video) assert.deepEqual(f.calls, [["youtube", video, ...(action === "image-import" ? [true] : [])]]);
      else assert.deepEqual(f.calls, [[action === "image-url" ? "url" : "import", image]]);
    });
  }
}
for (const action of ["link", "embeddable"]) {
  test(`HTML-only linked image: ${action} retains its anchor target`, () => {
    const f = fixture({ Files: true, "text/html": `<a href="${page}"><img src="${image}"></a>` }, action);
    f.manager.onDrop(f.event);
    assert.equal(f.calls[0].at(-1), page);
  });
}
for (const extension of ["jpg", "webp", "svg", "avif"]) {
  test(`${extension} URLs use production recognition rather than the file fallback`, () => {
    const source = `https://example.com/picture.${extension}?size=1`;
    const f = fixture({ Files: true, "text/plain": source }, "image-url");
    f.manager.onDrop(f.event);
    assert.deepEqual(f.calls, [["url", source]]);
  });
}
test("hook consumption prevents the blob-file import fallback", async () => {
  const f = fixture({ Files: true, "text/plain": "blob:https://example.com/image-id" }, "image-import", "link", true);
  f.manager.onDrop(f.event);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.calls.length, 0);
  assert.equal(f.hooks.length, 1);
});
for (const choice of ["Use", "Overwrite", "Import"]) {
  for (const browser of [false, true]) {
    test(`${browser ? "browser fallback" : "OS file"}: duplicate ${choice} preserves import behavior`, async () => {
      const payload = browser ? { Files: true, "text/plain": "blob:https://example.com/image-id" } : { Files: true };
      const f = fixture(payload, "image-import", "image-import", false, { duplicate: choice });
      f.manager.onDrop(f.event);
      await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(f.calls.map(call => call[0]), ["duplicate-choice", ...(choice === "Overwrite" ? ["overwrite"] : choice === "Import" ? ["file-import"] : []), "file-image"]);
      assert.equal(f.calls.at(-1)[3].path, choice === "Import" ? "picture.png" : "existing/picture.png");
    });
  }
}

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

for (const [action, operation] of [["image-url", "file-image"], ["embeddable", "embed"], ["link", "ea-text"]]) {
  test(`pure OS file: local ${action} wins over web image-import`, async () => {
    const f = fixture({ Files: true }, "image-import", action);
    assert.equal(f.manager.onDrop(f.event), false);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.calls.map(call => call[0]), [operation]);
    if (action === "image-url" || action === "embeddable") assert.equal(f.calls[0].at(-1), "file:///outside/picture.png");
  });
}

for (const browser of [false, true]) {
  test(`${browser ? "browser fallback" : "OS file"}: animated image keeps the insertion chooser`, async () => {
    const payload = browser ? { Files: true, "text/plain": "blob:https://example.com/image-id" } : { Files: true };
    const f = fixture(payload, "image-import", "image-import", false, { file: { name: "picture.gif", path: "/outside/picture.gif", type: "image/gif" } });
    f.manager.onDrop(f.event);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.calls.map(call => call[0]), ["file-import", "file-modal"]);
    assert.equal(f.calls[1][1].path, "picture.gif");
  });
}

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

for (const platform of ["Mac", "Win"]) {
  for (const extension of ["md", "pdf", "mp3", "mp4", "canvas"]) {
    test(`${platform}: supported ${extension} retains the interactive-frame tooltip`, () => {
      const f = fixture({ "text/plain": `supported.${extension}` }, "image-url", "image-import", false, { platform });
      f.app.dragManager.draggable = { type: "file", file: new f.TFile(`supported.${extension}`) };
      Object.assign(f.event, { shiftKey: platform === "Win", ctrlKey: true, altKey: false, metaKey: false });
      f.manager.onDragOver(f.event);
      assert.equal(f.div.innerText, "INTERNAL_DRAG_EMBEDDABLE");
    });
  }
  test(`${platform}: folder selection does not throw when checking eligible actions`, () => {
    const f = fixture({ "text/plain": "folder" }, "image-url", "image-import", false, { platform });
    f.app.dragManager.draggable = { type: "files", files: [{ path: "folder" }] };
    Object.assign(f.event, { shiftKey: true, ctrlKey: false, altKey: false, metaKey: false });
    f.manager.onDragOver(f.event);
    assert.equal(f.div.innerText, "INTERNAL_DRAG_LINK");
  });
  for (const plural of [false, true]) {
    for (const requested of ["link", "image", "image-fullsize", "embeddable"]) {
      test(`${platform}: unsupported font ${plural ? "files" : "file"} advertises only a link for ${requested}`, async () => {
        const f = fixture({ "text/plain": "obsidian://open?vault=test&file=EraserDust.ttf" }, "image-url", "image-import", false, { platform });
        const file = new f.TFile("EraserDust.ttf");
        f.app.dragManager.draggable = plural ? { type: "files", files: [file] } : { type: "file", file };
        const config = vm.runInNewContext(`(${modifierConfigNode.initializer.getText(settingsTree)})`);
        const rule = config[platform].InternalDragAction.rules.find(rule => rule.result === requested);
        Object.assign(f.event, { shiftKey: rule.shift, ctrlKey: platform === "Mac" ? rule.meta_ctrl : rule.ctrl_cmd, metaKey: platform === "Mac" ? rule.ctrl_cmd : rule.meta_ctrl, altKey: rule.alt_opt });
        f.manager.onDragOver(f.event);
        assert.equal(f.div.innerText, "INTERNAL_DRAG_LINK");
        f.manager.onDrop(f.event);
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(f.calls.map(call => call[0]), ["text"]);
      });
    }
  }
  test(`${platform}: registered custom file view retains the embeddable action`, async () => {
    const f = fixture({ "text/plain": "custom.filetype" }, "image-url", "image-import", false, { platform, viewTypes: { filetype: "custom-view" } });
    f.app.dragManager.draggable = { type: "file", file: new f.TFile("custom.filetype") };
    Object.assign(f.event, { shiftKey: platform === "Win", ctrlKey: true, altKey: false, metaKey: false });
    f.manager.onDragOver(f.event);
    assert.equal(f.div.innerText, "INTERNAL_DRAG_EMBEDDABLE");
    f.manager.onDrop(f.event);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.calls.map(call => call[0]), ["embed"]);
  });
  test(`${platform}: plural internal file payload uses the real Shift image action`, async () => {
    const f = fixture({ "text/plain": "obsidian://open?vault=test&file=inside.png" }, "image-url", "image-import", false, { platform });
    f.app.dragManager.draggable = { type: "files", files: [new f.TFile("inside.png")] };
    Object.assign(f.event, { shiftKey: true, ctrlKey: false, altKey: false, metaKey: false });
    assert.equal(f.manager.onDrop(f.event), false);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.calls.map(call => call[0]), ["ea-image"]);
    assert.equal(f.hooks[0].type, "file");
  });
  for (const shiftKey of [false, true]) {
    test(`${platform}: internal image drag resolves real Shift mapping and tooltip`, async () => {
      const f = fixture({ "text/plain": "obsidian://open?vault=test&file=inside.png" }, "image-url", "image-import", false, { platform });
      f.app.dragManager.draggable = { type: "file", file: new f.TFile("inside.png") };
      Object.assign(f.event, { shiftKey, ctrlKey: false, altKey: false, metaKey: false });
      f.manager.onDragOver(f.event);
      assert.ok(f.div.innerText.startsWith(shiftKey ? "INTERNAL_DRAG_IMAGE" : "INTERNAL_DRAG_LINK"));
      assert.equal(f.manager.onDrop(f.event), false);
      await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(f.calls.map(call => call[0]), [shiftKey ? "file-image" : "text"]);
      assert.equal(f.hooks[0].type, "file");
    });
  }
}

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
