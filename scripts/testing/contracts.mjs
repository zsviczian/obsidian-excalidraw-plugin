/** Shared, test-only artifact and report contract. No runtime dependencies. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const SCHEMA_VERSION = 2;
export const REQUIRED_ROLES = {
  plugin: ["main", "manifest", "styles"],
  fork: ["production-js", "production-css", "development-js", "development-css", "declarations"],
  extras: ["main", "manifest", "styles", "declarations"],
};
export const sha256 = value => createHash("sha256").update(value).digest("hex");
export const fileHash = path => sha256(readFileSync(path));

/** Canonical containment plus every component's link check, including junctions. */
export function ownedPath(root, relativePath, { existing = true } = {}) {
  assert.ok(typeof relativePath === "string" && relativePath && !relativePath.includes("\\") && !relativePath.includes("\0"), "Invalid relative path");
  assert.ok(!isAbsolute(relativePath) && !relativePath.split("/").some(p => !p || p === "." || p === ".." || p.includes(":")), "Path traversal");
  const base = resolve(root), destination = resolve(base, relativePath);
  assert.ok(relative(base, destination) && !relative(base, destination).startsWith(`..${sep}`), "Path escapes root");
  let current = base;
  // Check ancestors of the root as well; realpath containment alone allows a redirected root.
  for (let parent = base; ; parent = dirname(parent)) {
    if (existsSync(parent)) assert.ok(!lstatSync(parent).isSymbolicLink(), `Redirected path: ${parent}`);
    if (dirname(parent) === parent) break;
  }
  for (const part of relativePath.split("/")) {
    current = join(current, part);
    if (existsSync(current)) assert.ok(!lstatSync(current).isSymbolicLink(), `Redirected path: ${current}`);
  }
  if (existing) {
    assert.ok(existsSync(destination), `Missing artifact: ${relativePath}`);
    const actual = relative(realpathSync(base), realpathSync(destination));
    assert.ok(actual && actual !== ".." && !actual.startsWith(`..${sep}`) && !isAbsolute(actual), "Canonical path escapes root");
  }
  return destination;
}

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  if (result.error || result.status !== 0) throw Error(`Git provenance unavailable: ${result.error?.message || result.stderr}`);
  return result.stdout;
}

export function sourceIdentity(root) {
  const status = git(root, ["status", "--porcelain=v1", "-z"]);
  const untracked = git(root, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean).sort();
  return {
    commit: git(root, ["rev-parse", "HEAD"]).trim(), dirty: Boolean(status),
    diffHash: sha256(git(root, ["diff", "--binary", "HEAD"]) + JSON.stringify(untracked.map(path => [path, fileHash(ownedPath(root, path))]))),
    lockfileHash: fileHash(join(root, existsSync(join(root, "package-lock.json")) ? "package-lock.json" : "yarn.lock")),
  };
}

export function createArtifactManifest({ root, kind, repository, buildCommand, artifacts, identity = sourceIdentity(root), evidence = [] }) {
  assert.ok(REQUIRED_ROLES[kind], "Unknown producer kind");
  const manifest = { schemaVersion: SCHEMA_VERSION, kind, repository, ...identity, buildCommand,
    toolchain: { node: process.version, platform: process.platform }, evidence,
    artifacts: artifacts.map(({ role, relativePath }) => {
      const bytes = readFileSync(ownedPath(root, relativePath));
      return { role, relativePath, sha256: sha256(bytes), bytes: bytes.length };
    }) };
  validateArtifactManifest(manifest, root);
  return manifest;
}

export function validateArtifactManifest(manifest, root) {
  assert.equal(manifest.schemaVersion, SCHEMA_VERSION, "Unsupported artifact schema");
  assert.ok(REQUIRED_ROLES[manifest.kind], "Unknown producer kind");
  assert.match(manifest.repository, /^[\w.-]+\/[\w.-]+$/);
  assert.match(manifest.commit, /^[a-f0-9]{40}$/);
  assert.equal(typeof manifest.dirty, "boolean");
  for (const key of ["diffHash", "lockfileHash"]) assert.match(manifest[key], /^[a-f0-9]{64}$/);
  assert.ok(manifest.buildCommand && manifest.toolchain?.node, "Build provenance required");
  assert.ok(Array.isArray(manifest.artifacts) && manifest.artifacts.length, "No artifacts");
  const roles = new Set(), paths = new Set();
  for (const entry of manifest.artifacts) {
    assert.ok(!roles.has(entry.role) && !paths.has(entry.relativePath), "Duplicate artifact");
    roles.add(entry.role); paths.add(entry.relativePath);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes > 0, "Empty artifact");
    const content = readFileSync(ownedPath(root, entry.relativePath));
    assert.equal(content.length, entry.bytes, `Artifact size mismatch: ${entry.role}`);
    assert.equal(sha256(content), entry.sha256, `Artifact hash mismatch: ${entry.role}`);
  }
  for (const role of REQUIRED_ROLES[manifest.kind]) assert.ok(roles.has(role), `Missing ${role}`);
  return manifest;
}

/** Freeze first, then consume the snapshot; revalidate the producer after every copy. */
export function freezeArtifacts(manifest, producerRoot, snapshotRoot) {
  validateArtifactManifest(manifest, producerRoot);
  assert.ok(!existsSync(snapshotRoot), "Snapshot destination already exists");
  mkdirSync(snapshotRoot, { recursive: true });
  for (const entry of manifest.artifacts) {
    const target = ownedPath(snapshotRoot, entry.relativePath, { existing: false });
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(ownedPath(producerRoot, entry.relativePath), target);
  }
  validateArtifactManifest(manifest, producerRoot);
  validateArtifactManifest(manifest, snapshotRoot);
  writeFileSync(join(snapshotRoot, "artifacts.json"), JSON.stringify(manifest, null, 2) + "\n");
  return snapshotRoot;
}

/** Explicit migration: v1 smoke evidence does not imply unexecuted feature coverage. */
export function adaptSmokeReport(report) {
  assert.equal(report.schemaVersion, 1, "Expected legacy smoke schema 1");
  return { schemaVersion: SCHEMA_VERSION, suiteId: report.source?.requestedProfile==='soak'?'native-soak':"native-obsidian", source: report.source,
    status: report.status, cleanup: report.cleanup, error:report.error, cleanupError:report.cleanupError,
    tests: report.scenarios.flatMap(s => s.tests?.length ? s.tests : [{ ...s, testId: s.id, featureIds: [] }]), legacy: report };
}

export function aggregateReports(reports, requiredTestIds) {
  assert.ok(reports.length, "Missing reports");
  const tests = reports.flatMap(report => {
    assert.equal(report.schemaVersion, SCHEMA_VERSION, "Explicit report adapter required");
    assert.ok(report.suiteId && Array.isArray(report.tests) && report.tests.length, "Zero discovered tests");
    return report.tests;
  });
  assert.equal(new Set(tests.map(t => t.testId)).size, tests.length, "Duplicate test identity");
  for (const test of tests) {
    assert.ok(test.testId && ["passed", "failed", "blocked", "notApplicable"].includes(test.status), "Unknown test status");
    if (test.status !== "passed") assert.ok(test.reason, `Reason required: ${test.testId}`);
  }
  const missing = requiredTestIds.filter(id => !tests.some(t => t.testId === id));
  const unsuccessful = tests.filter(t => t.status !== "passed" && (t.status !== "notApplicable" || requiredTestIds.includes(t.testId)));
  const failedCleanup = reports.some(r => r.cleanup !== "passed" || r.status !== "passed");
  return { schemaVersion: SCHEMA_VERSION, suiteId: "aggregate", status: missing.length || unsuccessful.length || failedCleanup ? "failed" : "passed",
    cleanup: reports.every(r => r.cleanup === "passed") ? "passed" : "failed", requiredTestIds, missing, tests,
    failedSuites:reports.filter(r=>r.cleanup!=='passed'||r.status!=='passed').map(r=>({suiteId:r.suiteId,status:r.status,cleanup:r.cleanup,reason:r.error||r.cleanupError||'Suite or cleanup gate did not pass'})) };
}

/** Stable discovery used by the fixture/discovery gate; never follows links. */
export function walkFiles(root, prefix = "") {
  return readdirSync(join(root, prefix), { withFileTypes: true }).flatMap(entry => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    assert.ok(!entry.isSymbolicLink(), `Symlink in tracked corpus: ${path}`);
    return entry.isDirectory() ? walkFiles(root, path) : [path];
  }).sort();
}
