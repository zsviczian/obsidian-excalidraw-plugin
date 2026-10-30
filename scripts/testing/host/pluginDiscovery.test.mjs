import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { discoverStagedPlugin } from "./pluginDiscovery.mjs";
function host(plugins) {
  const state = { app: { plugins }, setTimeout, clearTimeout };
  vm.createContext(state);
  return {
    state,
    cli: (command, code) => {
      assert.equal(command, "eval");
      return String(vm.runInContext(code.slice(5), state));
    },
  };
}
test("fresh staged discovery awaits the actual host scan and cleans its task", async () => {
  const plugins = {
    manifests: {},
    loadManifests: async () => {
      await Promise.resolve();
      plugins.manifests["excalidraw-extras"] = { id: "excalidraw-extras" };
    },
  };
  const h = host(plugins);
  assert.equal(
    (await discoverStagedPlugin(h.cli, "excalidraw-extras")).discovery,
    "refreshed",
  );
  assert.equal(
    Object.keys(h.state).some((key) => key.startsWith("__")),
    false,
  );
});
test("missing discovery capability fails with an explicit first-open prerequisite", async () => {
  const h = host({ manifests: {} });
  await assert.rejects(
    discoverStagedPlugin(h.cli, "excalidraw-extras"),
    /open this owned vault/,
  );
  assert.equal(
    Object.keys(h.state).some((key) => key.startsWith("__")),
    false,
  );
});
