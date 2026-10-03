import test from "node:test";
import assert from "node:assert/strict";
import * as geometry from "../src/utils/markdownImageUtils.ts";

const display = (current, previousIntrinsic, nextIntrinsic, oldFlowWidth = 400, newFlowWidth = 400) =>
  geometry.getMarkdownImageDisplayGeometry?.({
    current,
    previousIntrinsic,
    nextIntrinsic,
    previousFlowWidth: oldFlowWidth,
    nextFlowWidth: newFlowWidth,
  });

test("unresized Markdown image grows to fit edited content", () => {
  assert.deepEqual(display({ x: 10, y: 20, width: 400, height: 120 }, { width: 400, height: 120 }, { width: 400, height: 240 }), { x: 10, y: 20, width: 400, height: 240 });
});

test("canvas enlargement survives content growth", () => {
  assert.deepEqual(display({ x: 10, y: 20, width: 800, height: 240 }, { width: 400, height: 120 }, { width: 400, height: 260 }), { x: 10, y: 20, width: 800, height: 240 });
});

test("canvas reduction and vertical-only resize survive content edits", () => {
  assert.deepEqual(display({ x: 10, y: 20, width: 200, height: 60 }, { width: 400, height: 120 }, { width: 400, height: 80 }), { x: 10, y: 20, width: 200, height: 60 });
  assert.deepEqual(display({ x: 10, y: 20, width: 400, height: 170 }, { width: 400, height: 120 }, { width: 400, height: 80 }), { x: 10, y: 20, width: 400, height: 170 });
});

test("legacy image without old intrinsic size keeps its display bounds", () => {
  assert.deepEqual(display({ x: 10, y: 20, width: 800, height: 240 }, undefined, { width: 400, height: 300 }), { x: 10, y: 20, width: 800, height: 240 });
});

test("explicit Markdown flow-width edit applies new intrinsic geometry", () => {
  assert.deepEqual(display({ x: 10, y: 20, width: 800, height: 240 }, { width: 400, height: 120 }, { width: 600, height: 300 }, 400, 600), { x: 10, y: 20, width: 600, height: 300 });
});

test("each copy sharing one file ID retains its own canvas size", () => {
  const oldSize = { width: 400, height: 120 };
  const nextSize = { width: 400, height: 200 };
  assert.deepEqual(display({ x: 10, y: 20, width: 800, height: 240 }, oldSize, nextSize), { x: 10, y: 20, width: 800, height: 240 });
  assert.deepEqual(display({ x: 900, y: 20, width: 200, height: 60 }, oldSize, nextSize), { x: 900, y: 20, width: 200, height: 60 });
});

test("flow-width change leaves a shared image copy at its chosen canvas size", () => {
  assert.deepEqual(
    geometry.getMarkdownImageDisplayGeometry?.({
      current: { x: 900, y: 20, width: 200, height: 60 },
      previousIntrinsic: { width: 400, height: 120 },
      nextIntrinsic: { width: 600, height: 300 },
      previousFlowWidth: 400,
      nextFlowWidth: 600,
      preserveBounds: true,
    }),
    { x: 900, y: 20, width: 200, height: 60 },
  );
});
