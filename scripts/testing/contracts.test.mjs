import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { adaptSmokeReport, aggregateReports, createArtifactManifest, freezeArtifacts, ownedPath, validateArtifactManifest } from "./contracts.mjs";
import { acquireHostLock } from "./host/hostLock.mjs";

const identity = { commit: "a".repeat(40), dirty: false, diffHash: "b".repeat(64), lockfileHash: "c".repeat(64) };
function setup(t) {
  const root = mkdtempSync(join(tmpdir(), "excalidraw-contract-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function producer(root) {
  const artifacts = ["main", "manifest", "styles"].map(role => ({ role, relativePath: `dist/${role}.bin` }));
  mkdirSync(join(root, "dist"));
  for (const a of artifacts) writeFileSync(join(root, a.relativePath), a.role);
  return createArtifactManifest({ root, kind: "plugin", repository: "zsviczian/obsidian-excalidraw-plugin", buildCommand: "npm run build", identity, artifacts });
}
test("producer artifacts freeze and reject byte changes, duplicate roles and missing artifacts", t => {
  const root = setup(t), manifest = producer(root), snapshot = join(root, "snapshot");
  freezeArtifacts(manifest, root, snapshot);
  assert.deepEqual(validateArtifactManifest(manifest, snapshot), manifest);
  assert.throws(() => freezeArtifacts(manifest, root, snapshot), /already exists/);
  const clone = structuredClone(manifest); clone.artifacts.push(clone.artifacts[0]);
  assert.throws(() => validateArtifactManifest(clone, root), /Duplicate/);
  const missing = structuredClone(manifest); missing.artifacts.pop();
  assert.throws(() => validateArtifactManifest(missing, root), /Missing styles/);
  writeFileSync(join(root, "dist/main.bin"), "xxxx");
  assert.throws(() => validateArtifactManifest(manifest, root), /mismatch/);
  assert.doesNotThrow(() => validateArtifactManifest(manifest, snapshot));
});
test("artifact paths reject escapes, Windows paths, separators, empty segments and redirects", t => {
  const root = setup(t), outside = setup(t);
  for (const path of ["../secret", "/etc/passwd", "C:/secret", "dist/../secret", "dist\\secret", "dist//secret", "./secret", ""]) {
    assert.throws(() => ownedPath(root, path, { existing: false }), /path|traversal|Invalid/i);
  }
  symlinkSync(outside, join(root, "redirect"), "junction");
  assert.throws(() => ownedPath(root, "redirect/file", { existing: false }), /Redirected/);
  assert.throws(() => ownedPath(join(root, "redirect"), "file", { existing: false }), /Redirected/);
});
test("explicit legacy adapter and required outcomes cannot greenwash a report", () => {
  const v1 = { schemaVersion: 1, status: "passed", cleanup: "passed", scenarios: [{ id: "case-a", status: "passed" }] };
  assert.throws(() => aggregateReports([v1], ["case-a"]), /adapter/);
  const adapted = adaptSmokeReport(v1);
  assert.equal(aggregateReports([adapted], ["case-a"]).status, "passed");
  assert.equal(aggregateReports([adapted], ["unexecuted"]).status, "failed");
  for (const status of ["failed", "blocked", "notApplicable"]) {
    const report = structuredClone(adapted); report.tests[0] = { testId: "case-a", status, reason: "intentional negative control" };
    assert.equal(aggregateReports([report], ["case-a"]).status, "failed");
  }
  assert.equal(aggregateReports([{ ...adapted, cleanup: "failed" }], ["case-a"]).status, "failed");
  assert.throws(() => aggregateReports([{ ...adapted, tests: [] }], []), /Zero/);
  assert.throws(() => aggregateReports([], []), /Missing/);
  assert.throws(() => aggregateReports([adapted, adapted], []), /Duplicate/);
});
test("native host exclusion spans vaults and preserves another controller's lock", t => {
  const root = setup(t), directory = join(root, "locks"), first = acquireHostLock({ userDataPath: root, directory });
  assert.throws(() => acquireHostLock({ userDataPath: root, directory }), /controlled/);
  const original = readFileSync(first.path, "utf8");
  writeFileSync(first.path, original.replace(JSON.parse(original).token, "another-owner"));
  assert.throws(() => first.release(), /ownership changed/);
  writeFileSync(first.path, original); first.release(); first.release();
  const second = acquireHostLock({ userDataPath: root, directory }); second.release();
});
test("stale lock recovery requires positive proof of a dead local owner", t => {
  const root = setup(t), directory = join(root, "locks"), first = acquireHostLock({ userDataPath: root, directory, pid: 999999 });
  assert.throws(() => acquireHostLock({ userDataPath: root, directory, alive: () => true }), /controlled/);
  const recovered = acquireHostLock({ userDataPath: root, directory, alive: () => false });
  assert.throws(() => first.release(), /ownership/);
  recovered.release();
});
