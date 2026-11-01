import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "./sourceHarness.mjs";

async function setup(t, overrides = {}) {
  const keys = ["window", "react", "reactDOM", "excalidrawLib", "ReactJSXRuntime", "ReactJSXDevRuntime", "unpackExcalidraw"];
  const previous = new Map(keys.map(key => [key, { exists: Object.hasOwn(globalThis, key), value: globalThis[key] }]));
  let evaluations = 0, common = 0, component = 0; const errors = [], notices = [];
  const lib = { restoreElements() {}, exportToSvg() {}, OBSIDIAN_COMMON_HOST_PROTOCOL_VERSION: 1, OBSIDIAN_EXCALIDRAW_HOST_PROTOCOL_VERSION: 4,
    configureObsidianCommonHost() { common++; let active = true; return () => { if (active) { common--; active = false; } }; },
    configureObsidianExcalidrawHost() { component++; let active = true; return () => { if (active) { component--; active = false; } }; }, ...overrides };
  Object.assign(globalThis, { window: {}, react: {}, reactDOM: {}, excalidrawLib: null, ReactJSXRuntime: {}, ReactJSXDevRuntime: {}, unpackExcalidraw: () => "reviewed artifact" });
  const graph = sourceHarness({
    "obsidian": { Notice: class { constructor(message) { notices.push(message); } } },
    "src/constants/constants": { updateExcalidrawLib() {} },
    "../../utils/ErrorHandler": { errorHandler: { safeEval() { evaluations++; return () => lib; }, handleError: error => errors.push(error), wrapWithTryCatch: fn => fn() } },
    "./obsidianCommonHostAdapter": { createObsidianCommonHostAdapter: (_, protocolVersion) => ({ protocolVersion }) },
    "./obsidianExcalidrawHostAdapter": { createObsidianExcalidrawHostAdapter: (_, protocolVersion) => ({ protocolVersion }) },
  });
  t.after(() => { graph.close(); for (const [key, value] of previous) { if (value.exists) globalThis[key] = value.value; else delete globalThis[key]; } });
  const { PackageManager } = await graph.importModule("src/core/managers/PackageManager.ts");
  const originalError = console.error; console.error = () => {}; let manager;
  try { manager = new PackageManager({ logStartupEvent() {} }); } finally { console.error = originalError; }
  return { manager, lib, errors, notices, counts: () => ({ evaluations, common, component }) };
}
test("one private runtime serves main and two popout leases; only final release removes the alias", async t => {
  const { manager, lib, counts } = await setup(t), popout = {};
  const main = manager.acquirePackage(window), a = manager.acquirePackage(popout), b = manager.acquirePackage(popout);
  assert.equal(main.window, window); assert.equal(a.window, popout);
  assert.equal(main.packages, a.packages); assert.equal(a.packages, b.packages);
  assert.deepEqual(counts(), { evaluations: 1, common: 1, component: 1 });
  assert.equal(popout.ExcalidrawLib, lib); assert.equal(popout.React, undefined); assert.equal(window.React, undefined);
  a.release(); a.release(); assert.equal(popout.ExcalidrawLib, lib);
  b.release(); assert.equal(popout.ExcalidrawLib, undefined);
  assert.equal(manager.getRuntimePackage().excalidrawLib, lib);
  main.release(); manager.destroy(); manager.destroy();
  assert.deepEqual(counts(), { evaluations: 1, common: 0, component: 0 });
  assert.throws(() => manager.acquirePackage(popout), /unavailable/);
});
test("destroy clears owned aliases and registrations without clobbering a replacement alias", async t => {
  const { manager, counts } = await setup(t), first = {}, second = {};
  const oldLease = manager.acquirePackage(first); manager.acquirePackage(second);
  const replacement = {}; second.ExcalidrawLib = replacement;
  manager.destroy(); oldLease.release();
  assert.equal(first.ExcalidrawLib, undefined); assert.equal(second.ExcalidrawLib, replacement);
  assert.deepEqual(counts(), { evaluations: 1, common: 0, component: 0 });
});
test("incompatible component protocol rolls back common host registration and exposes no runtime", async t => {
  const { manager, counts, errors, notices } = await setup(t, { OBSIDIAN_EXCALIDRAW_HOST_PROTOCOL_VERSION: 3 });
  assert.deepEqual(counts(), { evaluations: 1, common: 0, component: 0 });
  assert.equal(errors.length, 1); assert.match(String(errors[0]), /protocol 4/); assert.equal(notices.length, 1);
  assert.throws(() => manager.getRuntimePackage(), /unavailable/); manager.destroy();
});
test("failed second adapter registration rolls back the first and permits idempotent teardown", async t => {
  const { manager, counts, errors } = await setup(t, { configureObsidianExcalidrawHost() { throw Error("adapter registration failed"); } });
  assert.deepEqual(counts(), { evaluations: 1, common: 0, component: 0 });
  assert.match(String(errors[0]), /registration failed/); manager.destroy(); manager.destroy();
});
