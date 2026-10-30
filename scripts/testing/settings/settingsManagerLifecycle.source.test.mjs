/** Whole production manager/writer/key handling with controlled storage timing. */
import assert from "node:assert/strict";
import test from "node:test";
import { sourceHarness } from "../sourceHarness.mjs";

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};
const defaults = {
  libraryStorageMode: "vault", libraryMigrationStatus: "not-required",
  markdownImageSettings: { defaults: { border: {}, transclusion: { border: {} } } },
  markdownImageDeletionPreference: "keep", previewImageType: "SVGIMG",
  oEmbedAllowed: false, zoomMax: 3,
};
async function fixture(t, options = {}) {
  const harness = sourceHarness({
    obsidian: { Notice: class {} },
    "src/constants/constants": { JSON_parse: JSON.parse },
    "src/core/settingsDefaults": { DEFAULT_SETTINGS: structuredClone(defaults) },
    "src/types/utilTypes": { PreviewImageType: { SVGIMG: "SVGIMG", PNG: "PNG" } },
    "src/core/settings/SettingsRecoveryStore": { SettingsRecoveryStore: class {} },
    "src/shared/Dialogs/SettingsRecoveryPrompt": { SettingsRecoveryPrompt: class {} },
    "src/lang/helpers": { t: (key) => key },
  });
  t.after(() => harness.close());
  const { PluginSettingsManager } = await harness.importModule("src/core/managers/PluginSettingsManager.ts");
  const original = { ...structuredClone(defaults), zoomMax: 7, templateFilePath: "Templates/Custom.md",
    futureSetting: { flag: false, zero: 0, paths: ["custom"] } };
  const state = { disk: structuredClone(original), writes: [], reads: 0, stats: 0,
    recoveryWrites: [], destroyed: 0, prompts: 0 };
  const host = {
    app: { appId: "isolated-settings-test", vault: { adapter: { stat: async () => {
      state.stats++; return options.stat ? options.stat() : { size: 100 };
    } } } },
    manifest: { dir: ".obsidian/plugins/obsidian-excalidraw-plugin" },
    settings: structuredClone(original),
    loadData: async () => { state.reads++; return options.load ? options.load() : structuredClone(state.disk); },
    saveData: async (data) => {
      state.writes.push(structuredClone(data));
      if (options.save) await options.save(data);
      state.disk = structuredClone(data);
    },
  };
  const recovery = {
    load: async () => options.recoveryLoad ? options.recoveryLoad() : null,
    save: async (data) => { state.recoveryWrites.push(structuredClone(data)); if (options.recoverySave) await options.recoverySave(data); },
    destroy: () => { state.destroyed++; },
  };
  const manager = new PluginSettingsManager(host, recovery, async () => {
    state.prompts++;
    if (options.prompt) return options.prompt();
    throw Error("Unexpected recovery prompt");
  });
  return { manager, host, state, original };
}

test("late save after settings teardown cannot replace a custom configuration with an empty record", async (t) => {
  const { manager, host, state, original } = await fixture(t);
  manager.destroy(); host.settings = null;
  await manager.saveSettings();
  assert.deepEqual(state.disk, original);
  assert.equal(state.writes.length, 0);
  assert.equal(state.recoveryWrites.length, 0);
});

test("invalid runtime settings cannot be serialized into an empty or malformed configuration", async (t) => {
  const { manager, host, state, original } = await fixture(t);
  for (const invalid of [null, undefined, [], 3, "invalid"]) {
    host.settings = invalid; await manager.saveSettings();
  }
  assert.deepEqual(state.disk, original); assert.equal(state.writes.length, 0);
});

test("settings teardown is idempotent and retired loads perform no storage work", async (t) => {
  const { manager, host, state } = await fixture(t);
  manager.destroy(); manager.destroy(); host.settings = null;
  assert.equal(await manager.loadSettings(), false);
  assert.equal(state.destroyed, 1); assert.equal(state.stats, 0); assert.equal(state.reads, 0);
  assert.equal(state.prompts, 0); assert.equal(host.settings, null);
});

test("a queued settings write cannot start storage after its manager is destroyed", async (t) => {
  const { manager, state, original } = await fixture(t);
  const pending = manager.saveSettings(); manager.destroy();
  await pending;
  assert.deepEqual(state.disk, original); assert.equal(state.writes.length, 0);
  assert.equal(state.recoveryWrites.length, 0);
});

test("teardown during recovery persistence prevents an old instance from overwriting replacement settings", async (t) => {
  const started = deferred(), release = deferred();
  const { manager, state } = await fixture(t, { recoverySave: async () => { started.resolve(); await release.promise; } });
  const pending = manager.saveSettings(); await started.promise;
  manager.destroy(); const replacement = { replacement: true, future: { zero: 0, flag: false } };
  state.disk = structuredClone(replacement); release.resolve(); await pending;
  assert.deepEqual(state.disk, replacement); assert.equal(state.writes.length, 0);
});

test("teardown while checking the settings file prevents a delayed load from reading or mutating settings", async (t) => {
  const started = deferred(), release = deferred();
  const { manager, host, state, original } = await fixture(t, { stat: async () => { started.resolve(); return release.promise; } });
  const loading = manager.loadSettings(); await started.promise;
  manager.destroy(); host.settings = null; release.resolve({ size: 100 });
  assert.equal(await loading, false); assert.equal(host.settings, null);
  assert.equal(state.reads, 0); assert.deepEqual(state.disk, original);
});

test("teardown during a settings read prevents a delayed empty result from applying or persisting defaults", async (t) => {
  const started = deferred(), release = deferred();
  const { manager, host, state, original } = await fixture(t, { load: async () => { started.resolve(); return release.promise; } });
  const loading = manager.loadSettings(); await started.promise;
  manager.destroy(); host.settings = null; release.resolve({});
  assert.equal(await loading, false); assert.equal(host.settings, null);
  assert.deepEqual(state.disk, original); assert.equal(state.writes.length, 0);
});

test("a recovery choice completing after teardown cannot reset persisted preferences", async (t) => {
  const started = deferred(), release = deferred();
  const { manager, host, state, original } = await fixture(t, { stat: async () => null,
    load: async () => null, recoveryLoad: async () => ({ recovered: true }),
    prompt: async () => { started.resolve(); return release.promise; } });
  const loading = manager.loadSettings(); await started.promise;
  manager.destroy(); host.settings = null; release.resolve("reset-defaults");
  assert.equal(await loading, false); assert.equal(host.settings, null);
  assert.deepEqual(state.disk, original); assert.equal(state.writes.length, 0);
});

test("an already started disk write completes normally and a fresh manager reloads all custom fields", async (t) => {
  const started = deferred(), release = deferred();
  const { manager, host, state, original } = await fixture(t, { save: async () => { started.resolve(); await release.promise; } });
  const pending = manager.saveSettings(); await started.promise;
  manager.destroy(); host.settings = null; release.resolve(); await pending;
  assert.deepEqual(state.disk, original); assert.equal(state.writes.length, 1);
  const fresh = await fixture(t); fresh.state.disk = structuredClone(state.disk);
  assert.equal(await fresh.manager.loadSettings(), true);
  assert.deepEqual(fresh.host.settings, original);
  assert.deepEqual(fresh.state.disk, original);
});

test("a recovery read completing after teardown cannot resume startup or open a prompt", async (t) => {
  for (const missing of [false, true]) {
    const started = deferred(), release = deferred();
    const { manager, host, state, original } = await fixture(t, { stat: async () => missing ? null : { size: 100 },
      load: async () => null, recoveryLoad: async () => { started.resolve(); return release.promise; } });
    const loading = manager.loadSettings(); await started.promise;
    manager.destroy(); host.settings = null; release.resolve({ recovered: true });
    assert.equal(await loading, false); assert.equal(host.settings, null);
    assert.equal(state.prompts, 0); assert.deepEqual(state.disk, original);
  }
});

test("active storage errors still reject and a later retry preserves custom settings", async (t) => {
  let fail = true;
  const { manager, state, original } = await fixture(t, { save: async () => { if (fail) throw Error("disk failure"); } });
  await assert.rejects(manager.saveSettings(), /disk failure/);
  fail = false; await manager.saveSettings();
  assert.deepEqual(state.disk, original);
});
