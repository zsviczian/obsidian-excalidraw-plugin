/** Native CI preflight only: prove the explicitly provisioned session is isolated. */
import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ownedPath } from "../contracts.mjs";
import { validateOwnedVault } from "../provision.mjs";
import { parseCLIJSON } from "./inAppTask.mjs";
import { obsidianCliExecutable, spawnNativeSync } from "./processTools.mjs";
import { configureLocalVaultEnvironment } from "../localVault.mjs";
export function requireIsolatedSession({
  workRoot,
  vaultPath,
  vaultName,
  userDataPath,
  readHostUserData,
}) {
  assert.ok(
    workRoot && vaultPath && vaultName && userDataPath,
    "Set explicit owned automation vault and user-data paths",
  );
  const owned = validateOwnedVault({
    workRoot: resolve(workRoot),
    vaultPath: resolve(vaultPath),
  });
  assert.equal(owned.marker.vaultName, vaultName, "Wrong owned native vault");
  const marker = JSON.parse(
    readFileSync(ownedPath(userDataPath, ".excalidraw-native-session.json")),
  );
  assert.equal(marker.schemaVersion, 2);
  assert.equal(marker.owner, "obsidian-excalidraw-tests");
  assert.equal(
    marker.vaultId,
    owned.marker.vaultId,
    "Native session marker belongs to another vault",
  );
  const registry = JSON.parse(
    readFileSync(ownedPath(userDataPath, "obsidian.json")),
  );
  const registered = Object.values(registry.vaults || {});
  assert.equal(
    registered.length,
    1,
    "Native CI session must register exactly one owned vault",
  );
  assert.equal(
    realpathSync(registered[0].path),
    owned.vault,
    "Native CI session includes a different vault",
  );
  assert.equal(
    realpathSync(readHostUserData()),
    realpathSync(userDataPath),
    "CLI reached another application session",
  );
  return { vaultId: owned.marker.vaultId, isolated: true };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  configureLocalVaultEnvironment(
    resolve(dirname(fileURLToPath(import.meta.url)), "../../.."),
  );
  const vaultName = process.env.EXCALIDRAW_TEST_VAULT_NAME;
  requireIsolatedSession({
    workRoot: process.env.EXCALIDRAW_TEST_AUTOMATION_ROOT,
    vaultPath: process.env.EXCALIDRAW_TEST_VAULT_PATH,
    vaultName,
    userDataPath: process.env.EXCALIDRAW_TEST_USER_DATA_PATH,
    readHostUserData: () => {
      const r = spawnNativeSync(
        obsidianCliExecutable(),
        [
          "vault=" + vaultName,
          "eval",
          "code=JSON.stringify(require('@electron/remote').app.getPath('userData'))",
        ],
        { encoding: "utf8", timeout: 15000 },
      );
      if (r.error || r.status)
        throw Error("Native CI cannot reach its isolated host");
      return parseCLIJSON(r.stdout);
    },
  });
  process.stdout.write(
    "Verified one registered owned automation vault in the actual CLI session\n",
  );
}
