import assert from "node:assert/strict";
import { createJiti } from "jiti";

const log = (message) => process.stdout.write(`${message}\n`);
const jiti = createJiti(import.meta.url);
const { getDrawingModifyRoute, shouldInspectSuppressedModifyContent } =
  await jiti.import("../src/core/managers/fileModifyRouting.ts");

const route = (overrides = {}) =>
  getDrawingModifyRoute({
    fileExtension: "md",
    isEditingMarkdownSideInSplitView: false,
    isDirty: false,
    isPersistenceBusy: false,
    isStale: false,
    ...overrides,
  });

assert.equal(
  route({ isDirty: true, isStale: true }),
  "incremental-sync",
  "a stale dirty Markdown receiver must merge rather than reload",
);
assert.equal(
  route({ isPersistenceBusy: true, isStale: true }),
  "incremental-sync",
  "a stale busy Markdown receiver must queue synchronization",
);
assert.equal(
  route({ isStale: true }),
  "full-reload",
  "the existing clean and idle stale-view policy must remain intact",
);
assert.equal(
  route({ isEditingMarkdownSideInSplitView: true, isStale: true }),
  "incremental-sync",
  "the existing Markdown-side/recent-switch protection must remain intact",
);
assert.equal(
  route({ fileExtension: "excalidraw", isDirty: true, isStale: true }),
  "full-reload",
  "raw Excalidraw files retain the existing stale full-reload route",
);
assert.equal(
  route({ fileExtension: "excalidraw" }),
  "raw-reload",
  "recent raw Excalidraw modifies retain their existing reload route",
);
assert.equal(
  shouldInspectSuppressedModifyContent("md"),
  true,
  "Markdown notifications must reach exact-content inspection even while the legacy Boolean is armed",
);
assert.equal(
  shouldInspectSuppressedModifyContent("excalidraw"),
  false,
  "raw Excalidraw files retain their staged legacy suppression behavior",
);

log("file modify routing checks passed");
