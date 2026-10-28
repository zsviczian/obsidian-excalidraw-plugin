/** Discover a freshly staged plugin without changing Obsidian's global vault registry. */
import assert from "node:assert/strict";
import { runInAppTask } from "./inAppTask.mjs";
export async function discoverStagedPlugin(cli, id) {
  assert.ok(
    ["obsidian-excalidraw-plugin", "excalidraw-extras"].includes(id),
    "Unowned plugin discovery target",
  );
  return runInAppTask({
    cli,
    args: [id],
    execute: async (_c, id) => {
      if (app.plugins.manifests[id]) return { discovery: "existing" };
      if (typeof app.plugins.loadManifests !== "function")
        throw Error(
          "Host cannot discover staged plugins; open this owned vault once with the staged files before retrying",
        );
      await app.plugins.loadManifests();
      if (app.plugins.manifests[id]?.id !== id)
        throw Error("Staged plugin manifest was not discovered: " + id);
      return { discovery: "refreshed" };
    },
  });
}
