/** Install current frozen workspace builds and immutable configuration in the owned local vault. */
import assert from "node:assert/strict";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileHash, ownedPath, validateArtifactManifest } from "./contracts.mjs";
import {
  provisionVault,
  validateOwnedVault,
  verifySeed,
} from "./provision.mjs";
import { parseCLIJSON, runInAppTask } from "./host/inAppTask.mjs";
import { discoverStagedPlugin } from "./host/pluginDiscovery.mjs";
import { waitForNativeReady } from "./host/hostReadiness.mjs";
import {
  acquireDebuggerSession,
  unexpectedConsoleErrors,
} from "./host/debuggerSession.mjs";

export const LOCAL_VAULT_NAME = "excalidraw-auto-test";
export function localVaultTarget(projectRoot) {
  const automationRoot = resolve(projectRoot, ".test-work/vaults");
  const vaultPath = join(automationRoot, LOCAL_VAULT_NAME);
  return {
    vaultName: LOCAL_VAULT_NAME,
    vaultPath,
    configDir: join(vaultPath, ".obsidian"),
    automationRoot,
  };
}

/** Native entry points cannot inherit a personal or historical desktop target from the shell. */
export function configureLocalVaultEnvironment(projectRoot, env = process.env) {
  const target = localVaultTarget(projectRoot);
  for (const [key, value] of Object.entries({
    EXCALIDRAW_TEST_VAULT_NAME: target.vaultName,
    EXCALIDRAW_TEST_VAULT_PATH: target.vaultPath,
    EXCALIDRAW_TEST_CONFIG_DIR: target.configDir,
    EXCALIDRAW_TEST_AUTOMATION_ROOT: target.automationRoot,
  })) {
    assert.ok(
      !env[key] ||
        (key.endsWith("_NAME")
          ? env[key] === value
          : resolve(env[key]) === resolve(value)),
      key +
        " must identify the repository-local " +
        target.vaultName +
        " vault",
    );
  }
  Object.assign(env, {
    EXCALIDRAW_TEST_VAULT_NAME: target.vaultName,
    EXCALIDRAW_TEST_VAULT_PATH: target.vaultPath,
    EXCALIDRAW_TEST_CONFIG_DIR: target.configDir,
    EXCALIDRAW_TEST_AUTOMATION_ROOT: target.automationRoot,
  });
  return target;
}

/** Offline registration is read-only; opening/trust remains a documented one-time host prerequisite. */
export function registeredLocalVault(userDataPath, vaultPath) {
  const path = join(userDataPath, "obsidian.json");
  if (!existsSync(path)) return false;
  const { vaults = {} } = JSON.parse(readFileSync(path, "utf8"));
  return Object.values(vaults).some(
    (v) =>
      existsSync(v.path) &&
      realpathSync(v.path) === realpathSync(vaultPath) &&
      v.open === true,
  );
}

/** Serialized into the owned host. File copying alone cannot update a running Vault. */
export async function applyDeclaredHostConfiguration(
  c,
  configuration,
  corePlugins,
) {
  for (const [key, value] of Object.entries(configuration))
    app.vault.setConfig(key, value);
  const wanted = new Set(corePlugins);
  for (const id of wanted) {
    const plugin = app.internalPlugins.getPluginById(id);
    if (!plugin) throw Error("Required core plugin is unavailable: " + id);
    if (!plugin.enabled) await plugin.enable(false);
  }
  for (const [id, plugin] of Object.entries(app.internalPlugins.plugins)) {
    if (plugin.enabled && !wanted.has(id)) await plugin.disable(false);
  }
  await c.waitFor(async () => {
    const disk = await app.vault.readConfigJson("app");
    return Object.entries(configuration).every(
      ([key, value]) =>
        JSON.stringify(app.vault.getConfig(key)) === JSON.stringify(value) &&
        JSON.stringify(disk?.[key]) === JSON.stringify(value),
    );
  }, "declared application configuration persisted");
  await c.waitFor(async () => {
    const disk = await app.vault.readConfigJson("core-plugins");
    const enabled = app.internalPlugins
      .getEnabledPlugins()
      .map((plugin) => plugin.instance.id)
      .sort();
    // Obsidian accepts the legacy array but current hosts persist a boolean map.
    const persisted = Array.isArray(disk)
      ? disk
      : Object.entries(disk || {})
          .filter(([, value]) => value === true)
          .map(([id]) => id);
    return (
      JSON.stringify(enabled) === JSON.stringify([...wanted].sort()) &&
      JSON.stringify([...persisted].sort()) ===
        JSON.stringify([...wanted].sort())
    );
  }, "declared core plugins persisted");
  return { configuration, enabledCorePlugins: [...wanted] };
}

function declaredHostConfiguration(projectRoot) {
  const seed = join(projectRoot, "tests/vault/.obsidian");
  return [
    JSON.parse(readFileSync(join(seed, "app.json"), "utf8")),
    JSON.parse(readFileSync(join(seed, "core-plugins.json"), "utf8")),
  ];
}

export function installLocalVault({
  projectRoot,
  combination,
  target = localVaultTarget(projectRoot),
}) {
  assert.deepEqual(
    target,
    localVaultTarget(projectRoot),
    "Native testing must use the repository-local vault",
  );
  const corpus = verifySeed();
  if (!existsSync(target.vaultPath))
    provisionVault({ workRoot: target.automationRoot, name: target.vaultName });
  const owned = validateOwnedVault({
    workRoot: target.automationRoot,
    vaultPath: target.vaultPath,
  });
  for (const fixture of corpus.manifest.fixtures) {
    const destination = ownedPath(target.vaultPath, fixture.path, {
      existing: false,
    });
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(ownedPath(corpus.seed, fixture.path), destination);
    assert.equal(
      fileHash(destination),
      fixture.sha256,
      "Working seed copy changed: " + fixture.path,
    );
  }
  const installations = {};
  for (const [kind, id] of [
    ["plugin", "obsidian-excalidraw-plugin"],
    ["extras", "excalidraw-extras"],
  ]) {
    if (!combination.manifests[kind]) {
      assert.equal(kind, "extras", "Plugin producer is required");
      installations[kind] = {
        status: "missing",
        reason: "Extras checkout unavailable; Extras coverage cannot pass",
      };
      continue;
    }
    const root = join(combination.output, kind),
      manifest = validateArtifactManifest(combination.manifests[kind], root);
    const hashes = {};
    for (const [role, name] of [
      ["main", "main.js"],
      ["manifest", "manifest.json"],
      ["styles", "styles.css"],
    ]) {
      const entry = manifest.artifacts.find((a) => a.role === role);
      assert.ok(entry, "Missing " + kind + " " + role);
      const destination = ownedPath(
        target.configDir,
        "plugins/" + id + "/" + name,
        { existing: false },
      );
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(ownedPath(root, entry.relativePath), destination);
      hashes[name] = fileHash(destination);
      assert.equal(
        hashes[name],
        entry.sha256,
        "Installed " + id + " differs from workspace build",
      );
    }
    const installed = JSON.parse(
      readFileSync(
        join(target.configDir, "plugins", id, "manifest.json"),
        "utf8",
      ),
    );
    assert.equal(installed.id, id);
    const data = join(target.configDir, "plugins", id, "data.json");
    assert.ok(existsSync(data), "Missing declared plugin settings: " + id);
    installations[kind] = {
      status: "installed",
      id,
      source: manifest.commit,
      diffHash: manifest.diffHash,
      hashes,
      baselineSettingsHash: fileHash(data),
    };
  }
  const enabled = Object.values(installations)
    .filter((i) => i.status === "installed")
    .map((i) => i.id);
  writeFileSync(
    join(target.configDir, "community-plugins.json"),
    JSON.stringify(enabled, null, 2) + "\n",
  );
  writeFileSync(
    join(target.vaultPath, ".excalidraw-automation.json"),
    JSON.stringify({ ...owned.marker, seedHash: corpus.seedHash }, null, 2) +
      "\n",
  );
  const evidence = {
    schemaVersion: 2,
    target,
    seedHash: corpus.seedHash,
    installations,
    combinationPath: join(combination.output, "combination.json"),
  };
  writeFileSync(
    join(target.vaultPath, ".excalidraw-installed-build.json"),
    JSON.stringify(evidence, null, 2) + "\n",
  );
  return evidence;
}

/** The caller holds the shared application-session lock throughout preparation and scenarios. */
export async function prepareLocalVault({
  projectRoot,
  combination,
  userDataPath,
  cli,
}) {
  const target = localVaultTarget(projectRoot);
  // Create only the marker-owned seed before checking registration. No fallback vault is consulted.
  if (!existsSync(target.vaultPath))
    provisionVault({ workRoot: target.automationRoot, name: target.vaultName });
  validateOwnedVault({
    workRoot: target.automationRoot,
    vaultPath: target.vaultPath,
  });
  const opened = registeredLocalVault(userDataPath, target.vaultPath);
  let session;
  try {
    if (opened) {
      assert.equal(
        realpathSync(cli("vault", "info=path").trim()),
        realpathSync(target.vaultPath),
        "CLI selected another vault",
      );
      const host = parseCLIJSON(
        cli(
          "eval",
          "code=JSON.stringify({path:app.vault.adapter.getBasePath(),config:app.vault.configDir})",
        ),
      );
      assert.equal(realpathSync(host.path), realpathSync(target.vaultPath));
      assert.equal(
        realpathSync(join(host.path, host.config)),
        realpathSync(target.configDir),
      );
      const actualUserData = parseCLIJSON(
        cli(
          "eval",
          "code=JSON.stringify(require('@electron/remote').app.getPath('userData'))",
        ),
      );
      assert.equal(
        realpathSync(actualUserData),
        realpathSync(userDataPath),
        "Preparation CLI reached an application outside the held host lock",
      );
      session = acquireDebuggerSession(cli);
      await runInAppTask({
        cli,
        execute: async () => {
          const tasks = Object.keys(globalThis).filter((k) =>
            k.startsWith("__excalidrawTestTask_"),
          );
          if (tasks.length !== 1 || globalThis.__excalidrawCliSmoke)
            throw Error(
              "Previous native work is unsettled; preserve the vault for recovery",
            );
          const leaves = [];
          app.workspace.iterateAllLeaves((leaf) => leaves.push(leaf));
          for (const leaf of leaves) {
            const view = leaf.view;
            if (
              view.excalidrawAPI &&
              view.isDirty() &&
              (await view.saveWithOutcome()).status !== "persisted"
            )
              throw Error("Cannot settle working-vault drawing");
            if (view.file)
              await leaf.setViewState({ type: "empty", state: {} });
          }
          return { quiescent: true, mobile: app.isMobile === true };
        },
      });
      for (const id of ["obsidian-excalidraw-plugin", "excalidraw-extras"]) {
        const loaded = parseCLIJSON(
          cli(
            "eval",
            "code=JSON.stringify(!!app.plugins.plugins[" +
              JSON.stringify(id) +
              "])",
          ),
        );
        if (loaded) cli("plugin:disable", "id=" + id);
      }
    }
    const evidence = installLocalVault({ projectRoot, combination, target });
    if (!opened)
      return {
        ...evidence,
        ready: false,
        prerequisite:
          "Open " +
          target.vaultPath +
          " as a vault in Obsidian once, trust community plugins, enable CLI, and leave it open. Then repeat the same command. Installed plugin files and service settings are already prepared.",
      };
    const hostConfiguration = await runInAppTask({
      cli,
      execute: applyDeclaredHostConfiguration,
      args: declaredHostConfiguration(projectRoot),
    });
    for (const id of ["excalidraw-extras", "obsidian-excalidraw-plugin"]) {
      if (!Object.values(evidence.installations).some((i) => i.id === id))
        continue;
      await discoverStagedPlugin(cli, id);
      cli("plugin:enable", "id=" + id);
    }
    await waitForNativeReady(cli);
    const mode = parseCLIJSON(
      cli("eval", "code=JSON.stringify(app.isMobile===true)"),
    );
    if (mode) {
      // Mobile-mode changes reload the vault and retire its debugger controller.
      const errors = session.read();
      session.dispose();
      session = undefined;
      assert.deepEqual(
        unexpectedConsoleErrors(errors),
        [],
        "Preparation before mobile reset emitted errors",
      );
      cli("dev:mobile", "off");
      await waitForNativeReady(cli);
      session = acquireDebuggerSession(cli);
    }
    parseCLIJSON(
      cli(
        "eval",
        "code=JSON.stringify((()=>{app.changeTheme('moonstone');return true;})())",
      ),
    );
    const baseline = JSON.parse(
      readFileSync(
        join(
          projectRoot,
          "tests/vault/.obsidian/plugins/obsidian-excalidraw-plugin/data.json",
        ),
        "utf8",
      ),
    );
    const loaded = parseCLIJSON(
      cli(
        "eval",
        "code=JSON.stringify((()=>{const p=app.plugins.plugins['obsidian-excalidraw-plugin'],e=app.plugins.plugins['excalidraw-extras'];return {settings:p.settings,extras:e?{settings:e.settings,active:['mathjax','mermaid','pdf'].map(k=>e.api.features.isActive(k))}:null}})())",
      ),
    );
    for (const [key, value] of Object.entries(baseline))
      assert.deepEqual(
        loaded.settings[key],
        value,
        "Declared setting not applied: " + key,
      );
    if (evidence.installations.extras?.status === "installed")
      assert.deepEqual(
        loaded.extras?.active,
        [true, true, true],
        "Workspace Extras services must be active automatically",
      );
    return { ...evidence, hostConfiguration, ready: true };
  } finally {
    if (session) {
      const errors = session.read();
      session.dispose();
      assert.deepEqual(
        unexpectedConsoleErrors(errors),
        [],
        "Native preparation emitted unexpected errors",
      );
    }
  }
}

/** Restore declared values through the real settings writers after settled scenario cleanup. */
export async function restoreLocalVaultBaseline({ projectRoot, cli }) {
  const session = acquireDebuggerSession(cli);
  try {
    await runInAppTask({
      cli,
      execute: applyDeclaredHostConfiguration,
      args: declaredHostConfiguration(projectRoot),
    });
    const plugin = JSON.parse(
      readFileSync(
        join(
          projectRoot,
          "tests/vault/.obsidian/plugins/obsidian-excalidraw-plugin/data.json",
        ),
        "utf8",
      ),
    );
    const extras = JSON.parse(
      readFileSync(
        join(
          projectRoot,
          "tests/vault/.obsidian/plugins/excalidraw-extras/data.json",
        ),
        "utf8",
      ),
    );
    const corpus = verifySeed(),
      target = localVaultTarget(projectRoot);
    const content = corpus.manifest.fixtures.filter(
      (f) => !f.path.startsWith(".obsidian/"),
    );
    const changed = content
      .filter(
        (f) =>
          !existsSync(join(target.vaultPath, f.path)) ||
          fileHash(join(target.vaultPath, f.path)) !== f.sha256,
      )
      .map((f) => ({
        path: f.path,
        base64: readFileSync(join(corpus.seed, f.path)).toString("base64"),
      }));
    const result = await runInAppTask({
      cli,
      args: [plugin, extras, changed],
      execute: async (_c, plugin, extras, changed) => {
        const pending = Object.keys(globalThis).filter((k) =>
          k.startsWith("__excalidrawTestTask_"),
        );
        if (pending.length !== 1)
          throw Error("Other native work is unsettled; preserve the vault");
        const p = app.plugins.plugins["obsidian-excalidraw-plugin"],
          e = app.plugins.plugins["excalidraw-extras"];
        if (!p?.isReady)
          throw Error("Cannot restore baseline without the installed plugin");
        delete p.settings.__behaviorFutureSetting;
        Object.assign(p.settings, plugin);
        await p.saveSettings();
        if (e) {
          Object.assign(e.settings, extras);
          await e.saveSettings();
        }
        app.changeTheme("moonstone");
        for (const [key, value] of Object.entries(plugin))
          if (JSON.stringify(p.settings[key]) !== JSON.stringify(value))
            throw Error("Baseline setting not restored: " + key);
        const disk = await p.loadData();
        for (const [key, value] of Object.entries(plugin))
          if (JSON.stringify(disk[key]) !== JSON.stringify(value))
            throw Error("Baseline not persisted: " + key);
        for (const fixture of changed) {
          const parts = fixture.path.split("/");
          parts.pop();
          let folder = "";
          for (const part of parts) {
            folder += (folder ? "/" : "") + part;
            if (!app.vault.getFolderByPath(folder))
              await app.vault.createFolder(folder);
          }
          const bytes = Uint8Array.from(atob(fixture.base64), (ch) =>
            ch.charCodeAt(0),
          );
          const file = app.vault.getFileByPath(fixture.path);
          if (file) await app.vault.modifyBinary(file, bytes.buffer);
          else await app.vault.createBinary(fixture.path, bytes.buffer);
        }
        const leaked = app.vault
          .getFiles()
          .filter(
            (f) =>
              f.path.startsWith("__excalidraw_cli_smoke_") ||
              f.path.startsWith("__excalidraw_internal_drop_"),
          );
        if (leaked.length)
          throw Error(
            "Scenario-owned files remain; retain their exact paths for recovery: " +
              leaked.map((f) => f.path).join(", "),
          );
        return {
          restored: true,
          pluginEnabled: true,
          extrasEnabled: !!e,
          theme: app.vault.getConfig("theme"),
          restoredFixturePaths: changed.map((f) => f.path),
        };
      },
    });
    for (const fixture of content)
      assert.equal(
        fileHash(join(target.vaultPath, fixture.path)),
        fixture.sha256,
        "Baseline fixture not restored: " + fixture.path,
      );
    assert.equal(
      changed.length,
      0,
      "A scenario modified immutable fixture content; restored original bytes, but the regression remains failed: " +
        changed.map((f) => f.path).join(", "),
    );
    return result;
  } finally {
    const errors = session.read();
    session.dispose();
    assert.deepEqual(
      unexpectedConsoleErrors(errors),
      [],
      "Baseline restoration emitted unexpected errors",
    );
  }
}
