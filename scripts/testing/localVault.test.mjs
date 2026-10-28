import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createArtifactManifest, fileHash } from "./contracts.mjs";
import {
  installLocalVault,
  localVaultTarget,
  registeredLocalVault,
  configureLocalVaultEnvironment,
  applyDeclaredHostConfiguration,
} from "./localVault.mjs";

test("live preparation restores core activation and accepts Obsidian's persisted boolean map", async () => {
  const configuration = { livePreview: true, promptDelete: false, zero: 0 };
  const live = { livePreview: false, promptDelete: true, zero: 10 };
  const plugins = Object.fromEntries(
    ["command-palette", "file-explorer", "graph"].map((id) => [
      id,
      {
        instance: { id },
        enabled: id === "graph",
        async enable() {
          this.enabled = true;
        },
        disable() {
          this.enabled = false;
        },
      },
    ]),
  );
  let pendingWrites = 1;
  const app = {
    vault: {
      setConfig(key, value) {
        live[key] = value;
      },
      getConfig(key) {
        return live[key];
      },
      async readConfigJson(name) {
        if (name === "app") return pendingWrites-- > 0 ? {} : { ...live };
        return Object.fromEntries(
          Object.entries(plugins).map(([id, plugin]) => [id, plugin.enabled]),
        );
      },
    },
    internalPlugins: {
      plugins,
      getPluginById(id) {
        return plugins[id];
      },
      getEnabledPlugins() {
        return Object.values(plugins).filter((plugin) => plugin.enabled);
      },
    },
  };
  const c = {
    async waitFor(predicate, label) {
      for (let i = 0; i < 3; i++) if (await predicate()) return;
      throw Error(label);
    },
  };
  const execute = runInNewContext(
    "(" + applyDeclaredHostConfiguration.toString() + ")",
    { app },
  );
  for (let i = 0; i < 2; i++) {
    await execute(c, configuration, ["command-palette", "file-explorer"]);
    assert.deepEqual(live, configuration);
    assert.equal(plugins["command-palette"].enabled, true);
    assert.equal(plugins["file-explorer"].enabled, true);
    assert.equal(plugins.graph.enabled, false);
    live.promptDelete = true;
    plugins["command-palette"].enabled = false;
    plugins.graph.enabled = true;
  }
});

function fixture(t, extras = true) {
  const projectRoot = mkdtempSync(join(tmpdir(), "excalidraw-local-vault-"));
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));
  const output = join(projectRoot, "frozen"),
    manifests = {};
  for (const [kind, id] of [
    ["plugin", "obsidian-excalidraw-plugin"],
    ...(extras ? [["extras", "excalidraw-extras"]] : []),
  ]) {
    const root = join(output, kind);
    mkdirSync(join(root, "dist"), { recursive: true });
    const names = [
      "main.js",
      "manifest.json",
      "styles.css",
      ...(kind === "extras" ? ["index.d.ts"] : []),
    ];
    for (const name of names)
      writeFileSync(
        join(root, "dist", name),
        name === "manifest.json" ? JSON.stringify({ id }) : kind + " " + name,
      );
    manifests[kind] = createArtifactManifest({
      root,
      kind,
      repository: "tests/" + kind,
      buildCommand: "synthetic installation fixture",
      identity: {
        commit: "a".repeat(40),
        dirty: false,
        diffHash: "b".repeat(64),
        lockfileHash: "c".repeat(64),
      },
      artifacts: names.map((name, i) => ({
        role: ["main", "manifest", "styles", "declarations"][i],
        relativePath: "dist/" + name,
      })),
    });
  }
  return { projectRoot, combination: { output, manifests } };
}

test("native entry points reject desktop/personal target overrides before changing any environment value", (t) => {
  const { projectRoot } = fixture(t),
    env = {};
  configureLocalVaultEnvironment(projectRoot, env);
  assert.equal(env.EXCALIDRAW_TEST_VAULT_NAME, "excalidraw-auto-test");
  for (const [key, value] of [
    ["EXCALIDRAW_TEST_VAULT_NAME", "excalidraw-test"],
    ["EXCALIDRAW_TEST_VAULT_PATH", projectRoot],
    ["EXCALIDRAW_TEST_CONFIG_DIR", projectRoot],
  ]) {
    const bad = { ...env, [key]: value },
      before = { ...bad };
    assert.throws(
      () => configureLocalVaultEnvironment(projectRoot, bad),
      /repository-local/,
    );
    assert.deepEqual(bad, before);
  }
});

test("local working vault contains hash-verified executable plugins and declared settings, idempotently", (t) => {
  const input = fixture(t),
    first = installLocalVault(input),
    second = installLocalVault(input);
  assert.equal(first.seedHash, second.seedHash);
  for (const [kind, id] of [
    ["plugin", "obsidian-excalidraw-plugin"],
    ["extras", "excalidraw-extras"],
  ]) {
    const root = join(first.target.configDir, "plugins", id);
    for (const name of ["main.js", "manifest.json", "styles.css"])
      assert.equal(
        fileHash(join(root, name)),
        first.installations[kind].hashes[name],
      );
    assert.ok(
      Object.keys(JSON.parse(readFileSync(join(root, "data.json")))).length,
    );
  }
  assert.deepEqual(
    JSON.parse(
      readFileSync(join(first.target.configDir, "community-plugins.json")),
    ),
    ["obsidian-excalidraw-plugin", "excalidraw-extras"],
  );
  assert.equal(
    existsSync(join(first.target.vaultPath, "Assets/Small.pdf")),
    true,
  );
});

test("missing Extras is explicit and cannot masquerade as installed coverage", (t) => {
  const result = installLocalVault(fixture(t, false));
  assert.equal(result.installations.extras.status, "missing");
  assert.match(result.installations.extras.reason, /coverage cannot pass/);
  assert.deepEqual(
    JSON.parse(
      readFileSync(join(result.target.configDir, "community-plugins.json")),
    ),
    ["obsidian-excalidraw-plugin"],
  );
});

test("corrupt producer bytes and redirected destinations cannot become a prepared installation", (t) => {
  const input = fixture(t);
  installLocalVault(input);
  writeFileSync(
    join(input.combination.output, "plugin/dist/main.js"),
    "changed",
  );
  assert.throws(() => installLocalVault(input), /mismatch/);
  const other = fixture(t);
  const target = localVaultTarget(other.projectRoot);
  installLocalVault(other);
  const destination = join(target.configDir, "plugins/excalidraw-extras");
  rmSync(destination, { recursive: true });
  symlinkSync(
    join(target.configDir, "plugins/obsidian-excalidraw-plugin"),
    destination,
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.throws(() => installLocalVault(other), /Redirected/);
});

test("registration check accepts only the exact open local vault and never modifies the host registry", (t) => {
  const input = fixture(t),
    prepared = installLocalVault(input),
    userData = join(input.projectRoot, "user-data");
  mkdirSync(userData);
  const registry = join(userData, "obsidian.json");
  for (const open of [false, true]) {
    writeFileSync(
      registry,
      JSON.stringify({
        vaults: { owned: { path: prepared.target.vaultPath, open } },
      }),
    );
    const before = fileHash(registry);
    assert.equal(
      registeredLocalVault(userData, prepared.target.vaultPath),
      open,
    );
    assert.equal(fileHash(registry), before);
  }
});
