import assert from "node:assert/strict";
import test from "node:test";
import { stabilityFixture } from "./stability.mjs";
import { readFileSync } from "node:fs";
import vm from "node:vm";
test("large-scene stress stays bounded and deterministic with preserved prose and custom data", () => {
  const value = stabilityFixture();
  assert.equal(value, stabilityFixture());
  const scene = JSON.parse(value.match(/```json\n([\s\S]*?)\n```/)[1]);
  assert.equal(scene.elements.length, 1000);
  assert.ok(value.includes("User Markdown retained."));
  assert.ok(Math.max(...scene.elements.map((e) => e.x + e.width)) < 5000);
  assert.ok(Math.max(...scene.elements.map((e) => e.y + e.height)) < 2100);
  assert.equal(scene.elements[999].customData.retainedUnknown.value, 999);
  assert.throws(() => stabilityFixture(10000), /Bounded/);
});

test("failed stability loading retires the owned leaf before deleting its file", async () => {
  const source = readFileSync(
    new URL("./stability.mjs", import.meta.url),
    "utf8",
  );
  const cleanup = [],
    operations = [];
  let detached = false,
    closed = false,
    removed = false;
  const file = { path: "__excalidraw_cli_smoke_owned_stability.excalidraw.md" };
  const doc = { querySelectorAll: () => [{}] };
  const originalView = {
    containerEl: { isConnected: true, querySelector: () => null },
    excalidrawAPI: {},
    isDirty: () => false,
    getViewType: () => "excalidraw",
    file,
    isLoaded: false,
    semaphores: { justLoaded: true },
    isClosingOrMigrating: () => false,
  };
  const leaf = {
    id: "owned",
    view: originalView,
    async openFile() {},
    async setViewState(state) {
      assert.equal(state.type, "empty");
      closed = true;
      originalView.excalidrawAPI = null;
      operations.push("close");
      this.view = {
        containerEl: { isConnected: true },
        getViewType: () => "empty",
      };
    },
    detach() {
      detached = true;
      operations.push("detach");
      this.view.containerEl.isConnected = false;
    },
  };
  const anchor = {
      getRoot: () => root,
      view: { containerEl: { isConnected: true } },
    },
    root = {};
  const app = {
    plugins: {
      plugins: {
        "obsidian-excalidraw-plugin": { isExcalidrawFile: () => true },
      },
    },
    workspace: {
      containerEl: { ownerDocument: doc },
      activeLeaf: anchor,
      rootSplit: root,
      iterateAllLeaves: (fn) => fn(anchor),
      setActiveLeaf() {},
      getLeaf: () => leaf,
    },
    vault: {
      async create() {
        return file;
      },
      getFileByPath: () => (removed ? null : file),
      async delete() {
        assert.equal(
          closed,
          true,
          "Open file deletion can race Obsidian onDelete",
        );
        assert.equal(
          detached,
          true,
          "Leaf retirement must complete before file deletion",
        );
        removed = true;
        operations.push("delete");
      },
    },
  };
  const execute = vm.runInNewContext(
    "(" +
      source.slice(source.indexOf("async function exerciseStability")) +
      ")",
    { app, performance: { now: () => 0 } },
  );
  const c = {
    defer: (fn) => cleanup.push(fn),
    async waitFor(predicate, label) {
      if (label === "large fixture metadata") {
        assert.ok(predicate());
        return;
      }
      assert.equal(label, "large scene first commit");
      throw Error("owned first commit failure");
    },
    async waitForCleanup(predicate) {
      assert.ok(predicate());
    },
    case: async (_id, _features, fn) => fn(),
  };
  await assert.rejects(
    execute(c, file.path, "fixture", 6),
    /owned first commit failure/,
  );
  assert.equal(cleanup.length, 1);
  await cleanup[0]();
  assert.equal(removed, true);
  assert.deepEqual(operations, ["close", "detach", "delete"]);
});
