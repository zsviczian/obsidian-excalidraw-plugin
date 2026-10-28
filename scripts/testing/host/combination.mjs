/** Freeze all producers before native deployment; never read a sibling's live dist during staging. */
import assert from "node:assert/strict";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { produceArtifacts } from "../produceArtifacts.mjs";
import {
  sourceIdentity,
  validateArtifactManifest,
  ownedPath,
  fileHash,
} from "../contracts.mjs";
import { packageManagerInvocation } from "./processTools.mjs";
import { parseCLIJSON } from "./inAppTask.mjs";
import { discoverStagedPlugin } from "./pluginDiscovery.mjs";
export function produceCombination({
  pluginRoot,
  forkRoot,
  extrasRoot,
  output,
}) {
  output = resolve(output);
  assert.ok(!existsSync(output), "Combination output already exists");
  mkdirSync(output, { recursive: true });
  const roots = {
      plugin: resolve(pluginRoot),
      fork: resolve(forkRoot),
      extras: resolve(extrasRoot),
    },
    manifests = {};
  const run = ({ manager, args, cwd }) => {
    const invocation = packageManagerInvocation(manager, args);
    const r = spawnSync(invocation.file, invocation.args, {
      cwd,
      env: { ...process.env, EXCALIDRAW_FORK_ROOT: roots.fork },
      stdio: "inherit",
      windowsHide: true,
      timeout: 600000,
    });
    if (r.error || r.status)
      throw Error(
        "Producer " +
          manager +
          " " +
          args.join(" ") +
          " failed: " +
          (r.error?.message || r.status),
      );
  };
  for (const kind of ["fork", "extras"]) {
    if (kind === "extras" && !existsSync(join(roots.extras, "package.json")))
      continue;
    manifests[kind] = produceArtifacts({
      root: roots[kind],
      kind,
      snapshotRoot: join(output, kind),
      run,
    });
  }
  const installed = JSON.parse(
    readFileSync(
      join(roots.plugin, "node_modules/@zsviczian/excalidraw/package.json"),
      "utf8",
    ),
  );
  const declared = JSON.parse(
    readFileSync(join(roots.plugin, "package.json"), "utf8"),
  ).dependencies["@zsviczian/excalidraw"];
  assert.equal(
    installed.version,
    declared,
    "Install the exact declared fork package before local artifact handoff",
  );
  for (const entry of manifests.fork.artifacts.filter((entry) =>
    [
      "production-js",
      "production-css",
      "development-js",
      "development-css",
    ].includes(entry.role),
  )) {
    const name = entry.relativePath.split("/").at(-1);
    const target = ownedPath(
      roots.plugin,
      "node_modules/@zsviczian/excalidraw/dist/obsidian/" + name,
      { existing: false },
    );
    mkdirSync(join(target, ".."), { recursive: true });
    copyFileSync(ownedPath(join(output, "fork"), entry.relativePath), target);
  }
  manifests.plugin = produceArtifacts({
    root: roots.plugin,
    kind: "plugin",
    snapshotRoot: join(output, "plugin"),
    run,
  });
  for (const kind of Object.keys(manifests)) {
    validateArtifactManifest(manifests[kind], join(output, kind));
    const { commit, dirty, diffHash, lockfileHash } = manifests[kind];
    assert.deepEqual(
      sourceIdentity(roots[kind]),
      { commit, dirty, diffHash, lockfileHash },
      kind + " changed during combination build",
    );
  }
  const combination = { schemaVersion: 2, mode: "workspace", roots, manifests };
  writeFileSync(
    join(output, "combination.json"),
    JSON.stringify(combination, null, 2) + "\n",
  );
  return { ...combination, output };
}
export async function stageExtras({
  combination,
  target,
  cli,
  discoverPlugin = discoverStagedPlugin,
}) {
  if (!combination.manifests.extras)
    return {
      evidence: {
        status: "missing",
        reason:
          "Workspace Extras unavailable; Extras-dependent native cases cannot pass",
      },
      cleanup: () => {},
    };
  const root = join(combination.output, "extras"),
    manifest = validateArtifactManifest(combination.manifests.extras, root),
    id = "excalidraw-extras";
  const metadata = JSON.parse(
    readFileSync(
      ownedPath(
        root,
        manifest.artifacts.find((entry) => entry.role === "manifest")
          .relativePath,
      ),
      "utf8",
    ),
  );
  assert.equal(metadata.id, id, "Wrong Extras plugin manifest");
  const entries = manifest.artifacts
    .filter((entry) => ["main", "manifest", "styles"].includes(entry.role))
    .map((entry) => {
      const name = {
        main: "main.js",
        manifest: "manifest.json",
        styles: "styles.css",
      }[entry.role];
      return {
        ...entry,
        destination: ownedPath(target.config, "plugins/" + id + "/" + name, {
          existing: false,
        }),
      };
    });
  const before = parseCLIJSON(
    cli(
      "eval",
      "code=JSON.stringify({loaded:!!app.plugins.plugins['excalidraw-extras']})",
    ),
  );
  if (before.loaded) cli("plugin:disable", "id=" + id);
  const installedHashes = {};
  for (const entry of entries) {
    mkdirSync(join(entry.destination, ".."), { recursive: true });
    copyFileSync(ownedPath(root, entry.relativePath), entry.destination);
    installedHashes[entry.role] = fileHash(entry.destination);
    assert.equal(
      installedHashes[entry.role],
      entry.sha256,
      "Installed Extras byte mismatch",
    );
  }
  const discovery = await discoverPlugin(cli, id);
  cli("plugin:enable", "id=" + id);
  const end = Date.now() + 20000;
  for (;;) {
    const ready = parseCLIJSON(
      cli(
        "eval",
        "code=JSON.stringify(!!app.plugins.plugins['excalidraw-extras']?.api)",
      ),
    );
    if (ready) break;
    if (Date.now() > end) throw Error("Paired Extras API did not become ready");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return {
    evidence: {
      installedHashes,
      id,
      source: manifest.commit,
      sha256: manifest.artifacts.find((entry) => entry.role === "main").sha256,
      previouslyLoaded: before.loaded,
      ...discovery,
    },
    cleanup: () => {
      if (!before.loaded) cli("plugin:disable", "id=" + id);
    },
  };
}
