/** Execute the real SVG UI controller and XML preparation; no live Obsidian is required. */
import assert from "node:assert/strict";
import test from "node:test";
import { DOMParser } from "@xmldom/xmldom";
import { sourceHarness } from "./sourceHarness.mjs";

async function setup(t, choice = "convert") {
  const previous = {
    DOMParser: globalThis.DOMParser,
  };
  Object.assign(globalThis, { DOMParser });
  const notices = [],
    calls = [],
    created = [];
  let finish, pickFile, converter,
    scene = [];
  const file = { path: "Owned.excalidraw.md" },
    doc = {};
  const api = {
    id: "owner",
    isDestroyed: false,
    getAppState: () => ({ viewModeEnabled: false }),
    getSceneElements: () => scene,
    getFiles: () => files,
    selectElements: (elements) => calls.push({ select: elements }),
  };
  const files = {
    source: {
      mimeType: "image/svg+xml",
      dataURL:
        "data:image/svg+xml;base64," +
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50" fill="red"/><text x="10" y="30">東京 entrée</text></svg>',
        ).toString("base64"),
    },
  };
  const view = {
    file,
    ownerDocument: doc,
    excalidrawAPI: api,
    isLoaded: true,
    isClosingOrMigrating: () => false,
    setCurrentPositionToCenter: () => calls.push("center"),
    excalidrawData: { getFile: () => undefined },
    async addElements(options) {
      calls.push(options);
      options.validateBeforePublish();
      scene = options.newElements.filter((e) => !e.isDeleted);
      return true;
    },
    saveWithOutcome: async () => ({
      acknowledgedRevision: 1,
      requestedRevision: 1,
    }),
  };
  const plugin = {
    app: {
      workspace: { getLeavesOfType: () => [{ view }] },
      vault: { getFileByPath: () => file },
    },
    isExcalidrawFile: () => false,
  };
  view.plugin = plugin;
  view.app = plugin.app;
  const graph = sourceHarness({
    obsidian: {
      Notice: class {
        constructor(message) {
          notices.push(message);
        }
      },
    },
    "src/core": {
      getEA: () => {
        const ea = {
          elements: [],
          importSVG(source) {
            const result = converter(source);
            this.elements = result.content;
            calls.push({ importSource: source });
            return !result.hasErrors;
          },
          getElements() {
            return this.elements;
          },
          addToGroup() {
            this.elements.forEach((e) => e.groupIds.push("converted"));
          },
          getBoundingBox: ([e]) => ({
            topX: e.x,
            topY: e.y,
            width: e.width,
            height: e.height,
          }),
          copyViewElementsToEAforEditing(elements) {
            this.elements = structuredClone(elements);
          },
          destroy() {
            calls.push("destroy");
          },
        };
        return ea;
      },
    },
    "src/lang/helpers": { t: (key) => key },
    "src/utils/coreUtils": { errorlog: (error) => calls.push({ error }) },
    "src/utils/excalidrawAutomateUtils": {
      _measureText: (text, size, _family, lineHeight) => ({
        w: (text.length * size) / 2,
        h: size * lineHeight,
      }),
    },
    "src/utils/svgFilePicker": {
      openSVGFilePicker(target, callback) {
        created.push(target);
        pickFile = callback;
      },
    },
    "./Dialogs/Prompt": {
      MultiOptionConfirmationPrompt: class {
        constructor() {
          this.waitForClose =
            choice === "pending"
              ? new Promise((resolve) => {
                  finish = resolve;
                })
              : Promise.resolve(choice);
        }
      },
    },
    "roughjs/bin/math": {
      Random: class {
        next() {
          return 0.5;
        }
      },
    },
    "src/constants/constants": {
      ROUNDNESS: { LEGACY: 1 },
      nanoid: () => Math.random().toString(36).slice(2, 10),
    },
    "src/constants/safeUrls": {
      URLs: {
        GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_RELEASES_TAG:
          "https://example.test/releases",
      },
    },
    "src/utils/debugHelper": { log() {} },
  });
  const actions = await graph.importModule(
    "src/shared/svgConversionActions.ts",
  );
  const utils = await graph.importModule("src/utils/svgImageUtils.ts");
  converter = (await graph.importModule("src/shared/svgToExcalidraw/parser.ts")).svgToExcalidraw;
  const image = {
    id: "image",
    type: "image",
    fileId: "source",
    x: 100,
    y: 200,
    width: 200,
    height: 100,
    angle: 0,
    opacity: 60,
    scale: [1, 1],
    crop: null,
    groupIds: ["outer"],
    frameId: null,
    version: 1,
    versionNonce: 1,
    locked: false,
    isDeleted: false,
    customData: { mermaidText: "mindmap\n root((Example))" },
  };
  scene = [image];
  const diagram = { elements: [image], files };
  t.after(() => {
    graph.close();
    Object.assign(globalThis, previous);
  });
  return {
    ...actions,
    ...utils,
    plugin,
    view,
    api,
    image,
    diagram,
    files,
    notices,
    calls,
    created,
    pick: (file) => pickFile(file),
    finish: (value) => finish(value),
    setScene: (value) => {
      scene = value;
    },
  };
}
test("generated SVG data decodes UTF-8/base64 and percent encoding without a file", async (t) => {
  const f = await setup(t);
  assert.equal(f.getSVGImageData(f.view, f.image), f.files.source.dataURL);
  assert.match(f.decodeSVGDataURL(f.files.source.dataURL), /東京 entrée/);
  assert.equal(
    f.decodeSVGDataURL(
      "data:image/svg+xml," + encodeURIComponent("<svg>東京</svg>"),
    ),
    "<svg>東京</svg>",
  );
  assert.throws(() => f.decodeSVGDataURL("https://example.test/image.svg"));
  assert.throws(() =>
    f.decodeSVGDataURL(
      "data:image/svg+xml," + encodeURIComponent("<!DOCTYPE svg><svg/>"),
    ),
  );
});
test("image-menu import opens only the exact initiating editor", async (t) => {
  const f = await setup(t);
  f.openSVGImportForEditor(f.plugin, undefined);
  f.openSVGImportForEditor(f.plugin, "missing");
  assert.equal(f.created.length, 0);
  f.openSVGImportForEditor(f.plugin, "owner");
  assert.deepEqual(f.created, [f.view]);
  assert.equal(f.calls.length, 0, "Opening the chooser must not mutate the drawing");
});

test("system SVG selection reads File text and publishes grouped native elements directly", async (t) => {
  const f = await setup(t);
  f.openSVGImportForEditor(f.plugin, "owner");
  await f.pick({size:200, text:async()=>'<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="10" fill="red"/></svg>'});
  const publication = f.calls.find(c => c.newElements);
  assert.equal(publication.newElements[0].backgroundColor, "#ff0000");
  assert.ok(publication.newElements[0].groupIds.includes("converted"));
  assert.equal(publication.save, true);
  assert.equal(publication.repositionToCursor, true);
  assert.ok(f.calls.includes("center"));
  assert.ok(f.calls.includes("destroy"));
});

test("system SVG reads cannot publish into a changed editor", async (t) => {
  const f = await setup(t);
  f.openSVGImportForEditor(f.plugin, "owner");
  let finish;
  const pending = f.pick({size:20, text:()=>new Promise(r=>{finish=r;})});
  f.view.file = {path:'Changed.md'};
  finish('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
  await pending;
  assert.equal(f.calls.length, 0);
});

test("invalid, oversized and unreadable system SVG files never publish", async (t) => {
  const f = await setup(t);
  f.openSVGImportForEditor(f.plugin, "owner");
  await f.pick({size:2_000_001,text:async()=>{throw Error('Must not read oversized input');}});
  await f.pick({size:10,text:async()=>{throw Error('Read failed');}});
  await f.pick({size:10,text:async()=>'<not-svg/>'});
  assert.equal(f.calls.filter(c=>c.newElements).length,0);
  assert.equal(f.notices.length,2);
});
for (const choice of ["image", null])
  test(`Mermaid ${choice ?? "cancel"} choice does not convert or mutate the source`, async (t) => {
    const f = await setup(t, choice),
      before = JSON.stringify(f.diagram);
    const result = await f.prepareMermaidSVGInsert(
      f.plugin,
      "owner",
      f.diagram,
    );
    assert.equal(result, choice === "image" ? f.diagram : null);
    assert.equal(JSON.stringify(f.diagram), before);
    assert.equal(f.calls.length, 0);
  });
test("Mermaid conversion retains editable Unicode labels, image viewport, groups and opacity", async (t) => {
  const f = await setup(t),
    before = JSON.stringify(f.diagram),
    result = await f.prepareMermaidSVGInsert(f.plugin, "owner", f.diagram);
  assert.ok(result.elements.every((e) => e.type !== "image"));
  assert.equal(Object.keys(result.files).length, 0);
  const shape = result.elements.find((e) => e.type === "rectangle"),
    text = result.elements.find((e) => e.type === "text");
  assert.deepEqual(
    [shape.x, shape.y, shape.width, shape.height],
    [100, 200, 200, 100],
  );
  assert.equal(shape.opacity, 60);
  assert.ok(shape.groupIds.includes("outer"));
  assert.equal(text.rawText, "東京 entrée");
  assert.equal(JSON.stringify(f.diagram), before);
});
test("a prompt cannot publish into a changed drawing", async (t) => {
  const f = await setup(t, "pending"),
    pending = f.prepareMermaidSVGInsert(f.plugin, "owner", f.diagram);
  f.view.file = { path: "Different.excalidraw.md" };
  f.finish("convert");
  assert.equal(await pending, null);
  assert.equal(f.calls.length, 0);
});
test("context conversion replaces one image with a single guarded publication, retaining source bytes", async (t) => {
  const f = await setup(t),
    data = f.files.source.dataURL;
  assert.equal(await f.convertSVGImage(f.view, "image"), true);
  const publications = f.calls.filter((c) => c.newElements);
  assert.equal(publications.length, 1);
  assert.equal(publications[0].insertAtElementId, "image");
  assert.equal(
    publications[0].newElements.find((e) => e.id === "image").isDeleted,
    true,
  );
  assert.equal(f.files.source.dataURL, data);
  assert.equal(f.image.isDeleted, false);
  assert.equal(f.calls.filter((c) => c === "destroy").length, 2);
});
test("cropped or malformed SVGs leave the scene intact", async (t) => {
  const f = await setup(t);
  f.image.crop = { x: 1 };
  assert.equal(await f.convertSVGImage(f.view, "image"), false);
  assert.ok(f.notices.includes("SVG_CONVERSION_CROP"));
  f.image.crop = null;
  f.files.source.dataURL =
    "data:image/svg+xml," +
    encodeURIComponent('<svg><path d="invalid"/></svg>');
  assert.equal(await f.convertSVGImage(f.view, "image"), false);
  assert.equal(f.calls.filter((c) => c.newElements).length, 0);
});
test("source-image rotation is applied around its displayed center", async (t) => {
  const f = await setup(t);
  f.image.angle = Math.PI / 2;
  const result = await f.prepareMermaidSVGInsert(f.plugin, "owner", f.diagram);
  const shape = result.elements.find((e) => e.type === "rectangle");
  assert.ok(Math.abs(shape.angle - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(shape.x - 100) < 1e-9);
  assert.ok(Math.abs(shape.y - 200) < 1e-9);
});

test("SVG image preparation rejects excessive elements before constructing an XML DOM", async (t) => {
  const f = await setup(t),
    original = globalThis.DOMParser;
  let parsed = 0;
  globalThis.DOMParser = class {
    parseFromString() {
      parsed++;
      throw Error("DOM should not be constructed");
    }
  };
  try {
    assert.throws(
      () =>
        f.getSVGImageTransform(
          "<svg>" + "<g/>".repeat(20001) + "</svg>",
          f.image,
        ),
      /element limit/,
    );
    assert.equal(parsed, 0);
  } finally {
    globalThis.DOMParser = original;
  }
});

test("invalid image geometry is refused while zero opacity stays transparent", async (t) => {
  const f = await setup(t);
  f.image.angle = NaN;
  assert.equal(
    await f.prepareMermaidSVGInsert(f.plugin, "owner", f.diagram),
    null,
  );
  f.image.angle = 0;
  f.image.opacity = 0;
  const result = await f.prepareMermaidSVGInsert(f.plugin, "owner", f.diagram);
  assert.ok(result.elements.every((e) => e.opacity === 0));
});

test("SVG image placement does not duplicate root styles or create CSS ancestor matches", async (t) => {
  const f = await setup(t);
  f.files.source.dataURL =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><style>svg {opacity: .5} g rect {fill: blue}</style><rect width="100" height="50" fill="red"/></svg>',
    );
  const result = await f.prepareMermaidSVGInsert(f.plugin, "owner", f.diagram),
    shape = result.elements.find((e) => e.type === "rectangle");
  assert.deepEqual(
    { color: shape.backgroundColor, opacity: shape.opacity },
    { color: "#ff0000", opacity: 30 },
  );
});
