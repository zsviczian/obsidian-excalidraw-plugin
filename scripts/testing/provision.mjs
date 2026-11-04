/** Provision only disposable, explicitly owned copies of the immutable seed. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { fileHash, ownedPath, walkFiles } from "./contracts.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ROOT_MARKER = ".excalidraw-test-root.json", VAULT_MARKER = ".excalidraw-automation.json";
export function verifySeed(seed = join(projectRoot, "tests/vault"), manifestPath = join(projectRoot, "tests/fixtures/manifest.json")) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.schemaVersion, 2);
  assert.ok(manifest.fixtures.length, "Empty fixture seed");
  assert.deepEqual(walkFiles(seed), manifest.fixtures.map(f => f.path).sort(), "Seed file list drift");
  for (const entry of manifest.fixtures) assert.equal(fileHash(ownedPath(seed, entry.path)), entry.sha256, `Seed hash drift: ${entry.path}`);
  return { seed, seedHash: fileHash(manifestPath), manifest };
}
function rootMarker(workRoot, create) {
  assert.ok(isAbsolute(workRoot), "Automation work root must be absolute");
  // Validate a prospective child to check the root and its ancestors without following links.
  ownedPath(workRoot, ROOT_MARKER, { existing: false });
  const markerPath = join(workRoot, ROOT_MARKER);
  if (!existsSync(markerPath)) {
    assert.ok(create && (!existsSync(workRoot) || walkFiles(workRoot).length === 0), "Unowned nonempty automation root");
    mkdirSync(workRoot, { recursive: true });
    writeFileSync(markerPath, JSON.stringify({ schemaVersion: 2, owner: "obsidian-excalidraw-tests", rootId: randomUUID() }) + "\n", { flag: "wx" });
  }
  const marker = JSON.parse(readFileSync(markerPath, "utf8"));
  assert.ok(marker.schemaVersion === 2 && marker.owner === "obsidian-excalidraw-tests" && /^[a-f\d-]{36}$/.test(marker.rootId), "Invalid automation root marker");
  return marker;
}
export function validateOwnedVault({ workRoot, vaultPath }) {
  assert.ok(isAbsolute(vaultPath), "Vault path must be absolute");
  const root = rootMarker(workRoot, false), rel = relative(workRoot, vaultPath);
  assert.ok(rel && !rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel), "Vault must be beneath owned root");
  const vault = ownedPath(workRoot, rel.split(sep).join("/"));
  const marker = JSON.parse(readFileSync(ownedPath(vault, VAULT_MARKER), "utf8"));
  assert.ok(marker.schemaVersion === 2 && marker.rootId === root.rootId && marker.owner === root.owner && marker.vaultName === vault.split(sep).at(-1) && marker.vaultName.startsWith("excalidraw-auto-"), "Unowned automation vault");
  assert.ok(/^[a-f\d-]{36}$/.test(marker.vaultId) && /^[a-f\d]{64}$/.test(marker.seedHash), "Invalid vault ownership identity");
  ownedPath(vault, ".obsidian/community-plugins.json");
  return { vault, config: join(vault, ".obsidian"), marker, root };
}
export function provisionVault({ workRoot = join(projectRoot, ".test-work/vaults"), name = `excalidraw-auto-${randomUUID()}`, dryRun = false, seed, manifestPath } = {}) {
  assert.ok(/^excalidraw-auto-[^\\/:\0]+$/.test(name) && !/[. ]$/.test(name), "Automation vault name required");
  const corpus = verifySeed(seed, manifestPath), vaultPath = ownedPath(workRoot, name, { existing: false });
  if (dryRun) return { status: "preflight", vaultName: name, vaultPath, configDir: join(vaultPath, ".obsidian"), seedHash: corpus.seedHash };
  const root = rootMarker(workRoot, true);
  if (existsSync(vaultPath)) {
    const target = validateOwnedVault({ workRoot, vaultPath });
    assert.equal(target.marker.seedHash, corpus.seedHash, "Existing vault has different seed; explicit reset required");
    return { status: "existing", vaultName: name, vaultPath, configDir: target.config, ownership: target.marker };
  }
  mkdirSync(vaultPath);
  for (const fixture of corpus.manifest.fixtures) {
    const destination = ownedPath(vaultPath, fixture.path, { existing: false });
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(ownedPath(corpus.seed, fixture.path), destination);
    assert.equal(fileHash(destination), fixture.sha256, "Copied fixture changed");
  }
  const marker = { schemaVersion: 2, owner: root.owner, rootId: root.rootId, vaultId: randomUUID(), vaultName: name, seedHash: corpus.seedHash };
  writeFileSync(join(vaultPath, VAULT_MARKER), JSON.stringify(marker, null, 2) + "\n", { flag: "wx" });
  validateOwnedVault({ workRoot, vaultPath });
  return { status: "provisioned", vaultName: name, vaultPath, configDir: join(vaultPath, ".obsidian"), ownership: marker };
}
/** Caller must first close/quiesce owned views; explicit token prevents accidental whole-root deletion. */
export function resetOwnedVault({ workRoot, vaultPath, vaultId, quiescent = false }) {
  const target = validateOwnedVault({ workRoot, vaultPath });
  assert.equal(target.marker.vaultId, vaultId, "Reset ownership token differs");
  assert.equal(quiescent, true, "Close and quiesce the automation vault before reset");
  // The resolved, link-checked target was proved below workRoot; never remove the root or seed.
  rmSync(target.vault, { recursive: true });
  return { removed: true, vaultId };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const get = flag => { const i = process.argv.indexOf(flag); return i < 0 ? undefined : process.argv[i + 1]; };
  const result = provisionVault({ workRoot: get("--root") && resolve(get("--root")), name: get("--name"), dryRun: process.argv.includes("--dry-run") });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
