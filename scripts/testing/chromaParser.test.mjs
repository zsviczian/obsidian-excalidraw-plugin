/** Exercise the real build entry against the full library's accepted color behavior. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { test } from "node:test";
import { rollup } from "rollup";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import full from "chroma-js";
import { chromaParserOnly, createChromaParserEntry } from "../chromaParser.mjs";

const entry = fileURLToPath(import.meta.resolve("chroma-js"));
const bundle = await rollup({
  input: entry,
  plugins: [chromaParserOnly(), nodeResolve()],
});
let slim;
try {
  const { output } = await bundle.generate({ format: "cjs" });
  const module = { exports: {} };
  vm.runInNewContext(output[0].code, { module, exports: module.exports });
  slim = module.exports;
} finally {
  await bundle.close();
}

test("the private entry preserves every installed color input, hex and alpha result", () => {
  const cases = [
    ...Object.keys(full.colors),
    "transparent",
    "currentColor",
    "invalid",
    "rgb(10, 20, 30)",
    "rgba(20, 30, 40, 0.4)",
    "hsl(240, 50%, 30%)",
    "lab(50% 20 -10)",
    "lch(50% 20 100)",
    "oklab(50% 0.1 -0.1)",
    "oklch(50% 0.1 100)",
    "color(display-p3 1 0 0)",
    "#fff",
    "#fff0",
    "fff",
    "1",
    "red\n",
  ];
  let seed = 173;
  for (let i = 0; i < 1500; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    cases.push("#" + seed.toString(16).padStart(8, "0"));
  }
  for (const value of cases) {
    assert.equal(slim.valid(value), full.valid(value), value + " validity");
    if (!full.valid(value)) continue;
    assert.equal(slim(value).hex(), full(value).hex(), value + " hex");
    for (const alpha of [0, 0.17, 0.5, 1]) {
      assert.equal(
        slim(value).alpha(alpha).hex("rgba"),
        full(value).alpha(alpha).hex("rgba"),
        value + " alpha",
      );
    }
  }
  assert.equal(slim.scale, undefined);
  assert.equal(slim.brewer, undefined);
});
test("unexpected dependency entry layouts fail instead of silently dropping parsers", () => {
  assert.throws(
    () => createChromaParserEntry("export default {};"),
    /Unrecognized Chroma entry/,
  );
  const source = readFileSync(entry, "utf8");
  assert.throws(
    () =>
      createChromaParserEntry(
        source.replace("./src/io/named/index.js", "./moved.js"),
      ),
    /Unrecognized Chroma entry/,
  );
});
