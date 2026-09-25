import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import * as customData from "../src/utils/elementCustomDataUtils.ts";
import * as geometry from "../src/utils/markdownImageUtils.ts";

const utilsPath = fileURLToPath(new URL("../src/utils/utils.ts", import.meta.url));

function loadScaleLoadedImage(source = readFileSync(utilsPath, "utf8")) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: utilsPath,
  });
  const module = { exports: {} };
  const dependencies = {
    "../constants/constants": { EXCALIDRAW_PLUGIN: null },
    "./elementCustomDataUtils": customData,
    "./markdownImageUtils": geometry,
    "src/types/markdownImageTypes": {
      MARKDOWN_IMAGE_CUSTOM_DATA_KEY: customData.MARKDOWN_IMAGE_CUSTOM_DATA_KEY,
    },
    "roughjs/bin/math": { Random: class {} },
  };
  vm.runInNewContext(
    outputText,
    {
      module,
      exports: module.exports,
      require: (id) => dependencies[id] ?? {},
      Date,
    },
    { filename: utilsPath },
  );
  return module.exports.scaleLoadedImage;
}

const scaleLoadedImage = loadScaleLoadedImage();

function markdownImage(fileId, bounds, renderedSize, crop = null) {
  return {
    type: "image",
    fileId,
    ...bounds,
    crop,
    customData: {
      markdownImage: {
        schemaVersion: 1,
        version: 1,
        render: { width: 400 },
        ...(renderedSize ? { renderedSize } : {}),
      },
    },
  };
}

test("real scaleLoadedImage keeps resized copies and grows an untouched copy on reload", () => {
  const oldSize = { width: 400, height: 120 };
  const nextSize = { width: 400, height: 260 };
  const enlarged = markdownImage("shared", { x: 10, y: 20, width: 800, height: 240 }, oldSize);
  const reduced = markdownImage("shared", { x: 900, y: 30, width: 200, height: 60 }, oldSize);
  const untouched = markdownImage("shared", { x: 1200, y: 40, width: 400, height: 120 }, oldSize);
  const legacy = markdownImage("shared", { x: 1700, y: 50, width: 500, height: 160 }, null);
  const scene = { elements: [enlarged, reduced, untouched, legacy] };
  const files = [{ id: "shared", size: nextSize, shouldScale: true }];

  const result = scaleLoadedImage(scene, files);
  assert.equal(result.dirty, true);
  assert.equal(result.markdownImageChanged, true);
  assert.deepEqual([enlarged.x, enlarged.y, enlarged.width, enlarged.height], [10, 20, 800, 240]);
  assert.deepEqual([reduced.x, reduced.y, reduced.width, reduced.height], [900, 30, 200, 60]);
  assert.deepEqual([untouched.x, untouched.y, untouched.width, untouched.height], [1200, 40, 400, 260]);
  assert.deepEqual([legacy.x, legacy.y, legacy.width, legacy.height], [1700, 50, 500, 160]);
  for (const element of scene.elements) {
    assert.deepEqual(element.customData.markdownImage.renderedSize, nextSize);
  }

  const reopened = JSON.parse(JSON.stringify(scene));
  const secondLoad = scaleLoadedImage(reopened, files);
  assert.equal(secondLoad.dirty, false);
  assert.equal(secondLoad.markdownImageChanged, false);
  assert.deepEqual(
    reopened.elements.map(({ x, y, width, height }) => [x, y, width, height]),
    [[10, 20, 800, 240], [900, 30, 200, 60], [1200, 40, 400, 260], [1700, 50, 500, 160]],
  );
});

test("real scaleLoadedImage retains ordinary-image scaling and the existing crop path", () => {
  const ordinary = {
    type: "image",
    fileId: "ordinary",
    x: 20,
    y: 30,
    width: 400,
    height: 120,
    crop: null,
    customData: {},
  };
  const cropped = markdownImage(
    "shared",
    { x: 100, y: 200, width: 600, height: 200 },
    { width: 400, height: 120 },
    { x: 50, y: 10, width: 300, height: 100, naturalWidth: 400, naturalHeight: 120 },
  );
  const result = scaleLoadedImage(
    { elements: [ordinary, cropped] },
    [
      { id: "ordinary", size: { width: 400, height: 260 }, shouldScale: true },
      { id: "shared", size: { width: 400, height: 260 }, shouldScale: true },
    ],
  );

  assert.equal(result.markdownImageChanged, true);
  assert.ok(ordinary.width < 400);
  assert.ok(ordinary.height > 120);
  assert.equal(ordinary.customData.markdownImage, undefined);
  assert.equal(cropped.width, 600);
  assert.equal(cropped.height, 200);
  assert.equal(cropped.crop.naturalWidth, 400);
  assert.equal(cropped.crop.naturalHeight, 260);
  assert.deepEqual(cropped.customData.markdownImage.renderedSize, { width: 400, height: 260 });
});
