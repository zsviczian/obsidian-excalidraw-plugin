/** Preserve the former subset selection and physical file bytes using the shared registry. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import NativePromisePool from "es6-promise-pool";
import { sourceHarness } from "./sourceHarness.mjs";

const faces = JSON.parse(
  readFileSync(
    new URL("../../tests/fixtures/cjk-font-faces.json", import.meta.url),
  ),
);
const selections = JSON.parse(
  readFileSync(
    new URL("../../tests/fixtures/cjk-range-selections.json", import.meta.url),
  ),
);
class PromisePool {
  constructor(source, concurrency) {
    this.pool = new NativePromisePool(source, concurrency);
  }
  all() {
    return this.pool.start();
  }
}
const harness = sourceHarness({
  "./utils": {
    PromisePool,
    promiseTry: (callback) => Promise.resolve().then(callback),
  },
  "./fileUtils": {
    blobToBase64: async (blob) =>
      Buffer.from(await blob.arrayBuffer()).toString("base64"),
  },
});
const { getCJKFontFaceData, matchesCJKRange } = await harness.importModule(
  "src/utils/CJKLoader.ts",
);
test.after(() => harness.close());

function registry(subsets = faces) {
  return {
    registered: new Map([
      [1, { fontFaces: [{ fontFace: { family: "Virgil" }, urls: [] }] }],
      [
        100,
        {
          fontFaces: subsets.map(({ uri, descriptors }) => ({
            urls: [
              new URL(
                "https://fixture.invalid/fonts/" + encodeURIComponent(uri),
              ),
            ],
            fontFace: {
              family: "Xiaolai",
              unicodeRange: descriptors.unicodeRange,
            },
          })),
        },
      ],
    ]),
  };
}
for (const { ranges, indices } of selections) {
  test(`shared CJK registry preserves former selection and bytes for ${JSON.stringify(ranges)}`, async () => {
    const reads = [],
      settings = { ...ranges };
    const plugin = {
      getCJKFontSettings: () => settings,
      loadFontFromFile: async (name) => {
        reads.push(name);
        return new TextEncoder().encode(name).buffer;
      },
    };
    const result = await getCJKFontFaceData(plugin, registry());
    const expected = indices.map((i) => faces[i]);
    assert.deepEqual(
      reads,
      expected.map((face) => face.uri),
    );
    if (!expected.length) {
      assert.equal(result, false);
      return;
    }
    assert.equal(result.length, expected.length);
    for (let i = 0; i < result.length; i++) {
      assert.equal(
        Buffer.from(result[i].dataURL.split(",")[1], "base64").toString(),
        expected[i].uri,
      );
      assert.deepEqual(result[i].descriptors, expected[i].descriptors);
    }
  });
}
test("disabled CJK loading leaves the component registry uninitialized", async () => {
  const fonts = {
    get registered() {
      throw Error("Unexpected registry access");
    },
  };
  assert.equal(
    await getCJKFontFaceData(
      { getCJKFontSettings: () => ({ c: false, j: false, k: false }) },
      fonts,
    ),
    undefined,
  );
});
test("missing registry and missing local files retain the failure signal", async () => {
  const plugin = {
    getCJKFontSettings: () => ({ c: true, j: true, k: true }),
    loadFontFromFile: async () => undefined,
  };
  assert.equal(
    await getCJKFontFaceData(plugin, { registered: new Map() }),
    false,
  );
  assert.equal(await getCJKFontFaceData(plugin, registry()), false);
});
test("range filtering accepts FontFace-normalized uppercase ranges and structural URLs", async () => {
  assert.equal(
    matchesCJKRange(
      { uri: "test", descriptors: { unicodeRange: "U+4E00-9FFF" } },
      { c: true, j: false, k: false },
    ),
    true,
  );
  const bytes = new Uint8Array([0, 1, 255]);
  const plugin = {
    getCJKFontSettings: () => ({ c: true, j: false, k: false }),
    loadFontFromFile: async (name) => {
      assert.equal(name, "local subset.woff2");
      return bytes.buffer;
    },
  };
  const fonts = {
    registered: new Map([
      [
        100,
        {
          fontFaces: [
            {
              urls: [{ pathname: "/assets/local%20subset.woff2" }],
              fontFace: { family: "Xiaolai", unicodeRange: "U+4E00-9FFF" },
            },
          ],
        },
      ],
    ]),
  };
  const result = await getCJKFontFaceData(plugin, fonts);
  assert.deepEqual(
    [...Buffer.from(result[0].dataURL.split(",")[1], "base64")],
    [...bytes],
  );
});
