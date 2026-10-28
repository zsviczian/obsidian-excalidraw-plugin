import test from "node:test";
import assert from "node:assert/strict";
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
import { join, resolve } from "node:path";
import lz from "lz-string";
import {
  coreFixtures,
  drawingMarkdown,
  scene,
  smallPDF,
  transparentPNG,
} from "./fixtures.mjs";
import {
  provisionVault,
  resetOwnedVault,
  validateOwnedVault,
  verifySeed,
} from "./provision.mjs";

function temporary(t) {
  const root = mkdtempSync(join(tmpdir(), "excalidraw-provision-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
test("seed is deterministic, provenance-complete and retains saved data in all formats", () => {
  assert.equal(verifySeed().manifest.fixtures.length, 21);
  assert.deepEqual(coreFixtures(), coreFixtures());
  const compressed = drawingMarkdown(scene(), true).match(
    /```compressed-json\n([^\n]+)\n/,
  )[1];
  assert.deepEqual(JSON.parse(lz.decompressFromBase64(compressed)), scene());
  assert.match(drawingMarkdown(scene()), /User Markdown retained/);
  assert.equal(scene()["elements"][1].customData.retainedUnknown.value, 1);
  assert.equal(transparentPNG().readUInt32BE(16), 4);
  const pdf = smallPDF().toString();
  assert.match(pdf, /\/MediaBox \[0 0 200 160\]/);
  assert.match(pdf, /\/Count 1/);
  const start = Number(pdf.match(/startxref\n(\d+)/)[1]);
  assert.equal(pdf.slice(start, start + 4), "xref");
});
test("fresh copies work at independent roots with spaces and Unicode; provisioning is idempotent", (t) => {
  const parent = temporary(t);
  for (const suffix of [
    "First checkout",
    "\u6d4b\u8bd5 \u00c1rv\u00edzt\u0171r\u0151",
  ]) {
    const workRoot = join(parent, suffix),
      name = "excalidraw-auto-fixture";
    const dry = provisionVault({ workRoot, name, dryRun: true });
    assert.equal(dry.status, "preflight");
    assert.equal(existsSync(workRoot), false);
    const result = provisionVault({ workRoot, name });
    const again = provisionVault({ workRoot, name });
    assert.equal(again.ownership.vaultId, result.ownership.vaultId);
    assert.equal(
      validateOwnedVault({ workRoot, vaultPath: result.vaultPath }).marker
        .seedHash,
      result.ownership.seedHash,
    );
    assert.throws(
      () =>
        resetOwnedVault({
          workRoot,
          vaultPath: result.vaultPath,
          vaultId: result.ownership.vaultId,
        }),
      /quiesce/,
    );
    assert.throws(
      () =>
        resetOwnedVault({
          workRoot,
          vaultPath: result.vaultPath,
          vaultId: "wrong",
          quiescent: true,
        }),
      /token/,
    );
    resetOwnedVault({
      workRoot,
      vaultPath: result.vaultPath,
      vaultId: result.ownership.vaultId,
      quiescent: true,
    });
    assert.equal(existsSync(result.vaultPath), false);
  }
});
test("never adopts an existing arbitrary vault, nonempty root or seed for reset", (t) => {
  const parent = temporary(t),
    workRoot = join(parent, "owned");
  mkdirSync(workRoot);
  writeFileSync(join(workRoot, "personal.md"), "untouched");
  assert.throws(
    () => provisionVault({ workRoot, name: "excalidraw-auto-no" }),
    /Unowned/,
  );
  assert.equal(
    readFileSync(join(workRoot, "personal.md"), "utf8"),
    "untouched",
  );
  for (const name of [
    "personal",
    "excalidraw-auto-../escape",
    "excalidraw-auto-a\\b",
    "excalidraw-auto-a:b",
    "excalidraw-auto-a.",
  ])
    assert.throws(() => provisionVault({ workRoot, name }), /name/);
  assert.throws(() =>
    validateOwnedVault({
      workRoot: join(parent, "missing"),
      vaultPath: resolve("tests/vault"),
    }),
  );
});
test("redirected roots, config directories and cross-root ownership are rejected", (t) => {
  const parent = temporary(t),
    workRoot = join(parent, "first"),
    otherRoot = join(parent, "second");
  const target = provisionVault({ workRoot, name: "excalidraw-auto-links" });
  const other = provisionVault({
    workRoot: otherRoot,
    name: "excalidraw-auto-other",
  });
  const marker = join(target.vaultPath, ".excalidraw-automation.json");
  const saved = readFileSync(marker);
  writeFileSync(
    marker,
    readFileSync(join(other.vaultPath, ".excalidraw-automation.json")),
  );
  assert.throws(
    () => validateOwnedVault({ workRoot, vaultPath: target.vaultPath }),
    /Unowned/,
  );
  writeFileSync(marker, saved);
  rmSync(join(target.vaultPath, ".obsidian"), { recursive: true });
  symlinkSync(other.configDir, join(target.vaultPath, ".obsidian"), "junction");
  assert.throws(
    () => validateOwnedVault({ workRoot, vaultPath: target.vaultPath }),
    /Redirected/,
  );
  const redirect = join(parent, "redirect");
  symlinkSync(workRoot, redirect, "junction");
  assert.throws(
    () => provisionVault({ workRoot: redirect, name: "excalidraw-auto-links" }),
    /Redirected/,
  );
});
