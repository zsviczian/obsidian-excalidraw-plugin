/** Build a producer, fingerprint source before/after, then freeze verified outputs. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createArtifactManifest, freezeArtifacts, sourceIdentity, walkFiles } from "./contracts.mjs";
import { packageManagerInvocation } from "./host/processTools.mjs";

export function producerFiles(root, kind) {
  const plugin = ["main.js", "manifest.json", "styles.css"].map((file, i) => ({ role: ["main", "manifest", "styles"][i], relativePath: `dist/${file}` }));
  if (kind === "plugin") return plugin;
  if (kind === "extras") return [...plugin, ...declarations("api", "api/api/index.d.ts")];
  if (kind === "fork") return [
    ...["production.min.js", "production.min.css", "development.js", "development.css"].map((file, i) => ({ role: ["production-js", "production-css", "development-js", "development-css"][i], relativePath: `packages/excalidraw/dist/obsidian/excalidraw.${file}` })),
    { role: "package-manifest", relativePath: "packages/excalidraw/package.json" },
    ...declarations("packages/excalidraw/types", "packages/excalidraw/types/excalidraw/index.d.ts"),
  ];
  throw Error(`Unknown producer kind: ${kind}`);
  function declarations(base, entry) {
    const files = walkFiles(join(root, base)).filter(file => file.endsWith(".d.ts")).map(file => `${base}/${file}`);
    assert.ok(files.includes(entry), `Missing generated declaration entry: ${entry}`);
    return files.map(relativePath => ({ role: relativePath === entry ? "declarations" : `declaration:${relativePath}`, relativePath }));
  }
}

export function produceArtifacts({ root, kind, snapshotRoot, run = runBuild }) {
  assert.ok(["plugin", "fork", "extras"].includes(kind), "Unknown producer kind");
  assert.ok(!existsSync(snapshotRoot), "Snapshot already exists");
  const before = sourceIdentity(root);
  const steps = kind === "fork" ? [{ manager: "yarn", args: ["build:obsidian"], cwd: join(root, "packages/excalidraw") }]
    : [{ manager: "npm", args: ["run", "build"], cwd: root }, ...(kind === "extras" ? [{ manager: "npm", args: ["run", "build:api"], cwd: root }] : [])];
  for (const step of steps) run(step);
  assert.deepEqual(sourceIdentity(root), before, "Producer source changed while building; discard output and rebuild");
  const repository = `zsviczian/${kind === "fork" ? "excalidraw" : kind === "extras" ? "obsidian-excalidraw-extras" : "obsidian-excalidraw-plugin"}`;
  const manifest = createArtifactManifest({ root, kind, repository, identity: before, buildCommand: steps.map(step => `${step.manager} ${step.args.join(" ")}`).join(" && "), artifacts: producerFiles(root, kind) });
  freezeArtifacts(manifest, root, snapshotRoot);
  writeFileSync(join(snapshotRoot, "producer.json"), JSON.stringify({ ...manifest, sourceRoot: resolve(root) }, null, 2) + "\n");
  return manifest;
}

function runBuild({ manager, args, cwd }) {
  const invocation = packageManagerInvocation(manager, args);
  const result = spawnSync(invocation.file, invocation.args, { cwd, env: process.env, stdio: "inherit", windowsHide: true, timeout: 600_000 });
  if (result.error || result.status !== 0) throw Error(`Producer build failed: ${result.error?.message || result.status}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map(arg => { const match = arg.match(/^--(kind|root|snapshot)=(.+)$/); if (!match) throw Error("Use --kind=plugin|fork|extras --root=PATH --snapshot=NEW_PATH"); return match.slice(1); }));
  if (!args.kind || !args.root || !args.snapshot) throw Error("Producer kind, root and new snapshot are required");
  const manifest = produceArtifacts({ kind: args.kind, root: resolve(args.root), snapshotRoot: resolve(args.snapshot) });
  process.stdout.write(`${manifest.kind}: ${manifest.artifacts.length} frozen artifacts, commit ${manifest.commit}, dirty=${manifest.dirty}\n`);
}
