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
  mdSVGwidth: 500, mdFont: "Virgil", mdFontColor: "#000000", mdBorderColor: "#000000",
  markdownImageSettings: { defaults: { width: 500, fontFamily: "Virgil", fontColor: "#000000",
    border: { enabled: false, color: "#000000" }, css: "", transclusion: { border: {} } } },
  markdownImageDeletionPreference: "keep", pasteCodeBlockAs: "ask", previewImageType: "SVGIMG",
  oEmbedAllowed: false, zoomMax: 3, allowWheelZoom: false, pinnedScripts: [], scriptEngineSettings: {},
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
    allowWheelZoom: true, pinnedScripts: ["Capture Note"],
    scriptEngineSettings: { "Capture Note": { noteTypes: { Custom: { template: "Templates/Note.md" } } } },
    futureSetting: { flag: false, zero: 0, paths: ["custom"] } };
  const state = { disk: structuredClone(original), writes: [], reads: 0, stats: 0,
    recoveryWrites: [], recoveryReads: 0, destroyed: 0, prompts: 0, promptModes: [] };
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
    load: async () => { state.recoveryReads++; return options.recoveryLoad ? options.recoveryLoad() : null; },
    save: async (data) => { state.recoveryWrites.push(structuredClone(data)); if (options.recoverySave) await options.recoverySave(data); },
    destroy: () => { state.destroyed++; },
  };
  const manager = new PluginSettingsManager(host, recovery, async (mode) => {
    state.prompts++;
    state.promptModes.push(mode);
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
  for (const invalid of [{}, null, undefined, [], 3, "invalid"]) {
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

test("empty startup settings restore custom preferences and unknown keys from recovery", async (t) => {
  let backup;
  const { manager, host, state, original } = await fixture(t, { recoveryLoad: async () => structuredClone(backup),
    recoverySave: async data => { backup = structuredClone(data); } });
  backup = structuredClone(original); state.disk = {}; host.settings = null;
  assert.equal(await manager.loadSettings(), false);
  assert.deepEqual(host.settings, original); assert.deepEqual(state.disk, original);
  assert.deepEqual(backup, original); assert.equal(state.recoveryReads, 1);
  assert.equal(state.prompts, 0); assert.equal(state.writes.length, 1);
});

test("empty startup settings without recovery wait for a valid file without persisting defaults", async (t) => {
  const { manager, host, state, original } = await fixture(t, { prompt: async () => "wait-for-file" });
  state.disk = {}; host.settings = null;
  assert.equal(await manager.loadSettings(), false);
  await manager.saveSettings();
  assert.deepEqual(state.disk, {}); assert.equal(state.writes.length, 0);
  assert.equal(state.recoveryWrites.length, 0);
  assert.deepEqual(state.promptModes, ["invalid-without-recovery"]);
  state.disk = structuredClone(original);
  assert.equal(await manager.loadSettings(), true);
  assert.deepEqual(host.settings, original); assert.deepEqual(state.disk, original);
});

test("empty recovery snapshots cannot silently reset empty startup settings", async (t) => {
  const { manager, state } = await fixture(t, { recoveryLoad: async () => ({}), prompt: async () => "wait-for-file" });
  state.disk = {};
  assert.equal(await manager.loadSettings(), false);
  assert.deepEqual(state.promptModes, ["invalid-without-recovery"]);
  assert.equal(state.writes.length, 0); assert.equal(state.recoveryWrites.length, 0);
});

test("empty startup settings reset to defaults only after the explicit recovery choice", async (t) => {
  const { manager, host, state } = await fixture(t, { prompt: async () => "reset-defaults" });
  state.disk = {};
  assert.equal(await manager.loadSettings(), false);
  assert.deepEqual(state.promptModes, ["invalid-without-recovery"]);
  assert.deepEqual(host.settings, defaults); assert.deepEqual(state.disk, defaults);
  assert.deepEqual(state.recoveryWrites, [defaults]);
});

test("missing first-install settings still initialize defaults without prompting", async (t) => {
  const { manager, host, state } = await fixture(t, { stat: async () => null, load: async () => null });
  assert.equal(await manager.loadSettings(), true);
  assert.deepEqual(host.settings, defaults); assert.deepEqual(state.disk, defaults);
  assert.equal(state.prompts, 0);
});

test("missing settings with recovery retain the restore-or-defaults choice", async (t) => {
  for (const choice of ["restore-recovery", "reset-defaults"]) {
    let backup;
    const { manager, host, state, original } = await fixture(t, { stat: async () => null, load: async () => null,
      recoveryLoad: async () => backup, prompt: async () => choice });
    backup = structuredClone(original);
    assert.equal(await manager.loadSettings(), true);
    assert.deepEqual(state.promptModes, ["missing-with-recovery"]);
    const expected = choice === "restore-recovery" ? original : defaults;
    assert.deepEqual(host.settings, expected); assert.deepEqual(state.disk, expected);
  }
});

test("empty synchronized settings repair disk from live preferences even when the snapshot is unchanged", async (t) => {
  const { manager, host, state, original } = await fixture(t);
  await manager.loadSettings();
  state.disk = {};
  assert.equal(await manager.loadSettings(), false);
  assert.deepEqual(host.settings, original); assert.deepEqual(state.disk, original);
  assert.equal(state.prompts, 0); assert.equal(state.recoveryReads, 0);
  assert.deepEqual(state.recoveryWrites.at(-1), original);
});

test("an empty synchronized record during a pending save preserves the latest settings", async (t) => {
  const started = deferred(), release = deferred(); let delay = false;
  const { manager, host, state, original } = await fixture(t, { recoverySave: async () => {
    if (delay) { started.resolve(); await release.promise; }
  } });
  await manager.loadSettings(); delay = true;
  host.settings.zoomMax = 9;
  const saving = manager.saveSettings(); await started.promise;
  host.settings.futureSetting.flag = true; state.disk = {};
  const repairing = manager.loadSettings();
  // Allow the empty read to complete while the earlier immutable save is paused.
  while (state.reads < 2) await new Promise(resolve => setImmediate(resolve));
  release.resolve(); await saving;
  assert.equal(await repairing, false);
  const expected = { ...original, zoomMax: 9, futureSetting: { ...original.futureSetting, flag: true } };
  assert.deepEqual(host.settings, expected); assert.deepEqual(state.disk, expected);
  assert.deepEqual(state.recoveryWrites.at(-1), expected);
});

test("nonempty settings containing only unknown keys remain valid and preserved", async (t) => {
  const { manager, host, state } = await fixture(t);
  const unknown = { futureSetting: { flag: false, zero: 0, paths: ["custom"] } };
  state.disk = structuredClone(unknown);
  assert.equal(await manager.loadSettings(), true);
  assert.deepEqual(host.settings.futureSetting, unknown.futureSetting);
  assert.deepEqual(state.disk.futureSetting, unknown.futureSetting);
  assert.equal(state.recoveryReads, 0); assert.equal(state.prompts, 0);
});

test("code block format defaults to asking and remembered formats survive a fresh settings manager", async (t) => {
  for (const preference of ["markdown-image", "embeddable"]) {
    const initial = await fixture(t);
    delete initial.state.disk.pasteCodeBlockAs;
    await initial.manager.loadSettings();
    assert.equal(initial.host.settings.pasteCodeBlockAs, "ask");
    initial.host.settings.pasteCodeBlockAs = preference;
    await initial.manager.saveSettings();
    const reloaded = await fixture(t, { load: async () => structuredClone(initial.state.disk) });
    await reloaded.manager.loadSettings();
    assert.equal(reloaded.host.settings.pasteCodeBlockAs, preference);
    assert.deepEqual(reloaded.host.settings.futureSetting, initial.original.futureSetting);
    assert.equal(reloaded.state.prompts, 0);
  }
});
