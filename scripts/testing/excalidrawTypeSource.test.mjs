import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import {
  localExcalidrawTypePaths,
  obsidianArtifacts,
} from "../excalidrawTypeSource.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "excalidraw-types-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const plugin = join(root, "plugin"),
    fork = join(root, "excalidraw");
  const write = (path, value) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, value);
  };
  const declaration = join(
    fork,
    "packages/excalidraw/types/excalidraw/obsidianExcalidrawHost.d.ts",
  );
  write(declaration, "export declare const protocol: 3;");
  const local = (name) => join(fork, "packages/excalidraw/dist/obsidian", name);
  const installed = (name) =>
    join(plugin, "node_modules/@zsviczian/excalidraw/dist/obsidian", name);
  for (const name of obsidianArtifacts) {
    write(local(name), name);
    write(installed(name), name);
  }
  return { plugin, fork, declaration, local, installed, write };
}

test("local handoff uses one matching canonical declaration graph", (t) => {
  const f = fixture(t),
    paths = localExcalidrawTypePaths(f.plugin);
  assert.deepEqual(paths["@excalidraw/common"], [
    resolve(f.fork, "packages/excalidraw/types/common/src/index.d.ts"),
  ]);
  assert.deepEqual(paths["@zsviczian/excalidraw/*"], [
    resolve(f.fork, "packages/excalidraw/*"),
  ]);
});
for (const name of obsidianArtifacts) {
  test(`mismatched ${name} cannot select unrelated local declarations`, (t) => {
    const f = fixture(t);
    f.write(f.installed(name), "different build");
    assert.equal(localExcalidrawTypePaths(f.plugin, f.fork), undefined);
  });
}
test("missing local declaration or runtime leaves installed package resolution intact", (t) => {
  const f = fixture(t);
  rmSync(f.declaration);
  assert.equal(localExcalidrawTypePaths(f.plugin), undefined);
  f.write(f.declaration, "export {};");
  rmSync(f.local(obsidianArtifacts[0]));
  assert.equal(localExcalidrawTypePaths(f.plugin), undefined);
});
