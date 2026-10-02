/** Build the local fork and plugin, then run the guarded native test-vault smoke. */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { runObsidianSmoke } from "./runner.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const forkRoot = resolve(process.env.EXCALIDRAW_FORK_ROOT || join(pluginRoot, "../excalidraw"));
const reportDir = process.env.EXCALIDRAW_TEST_REPORT_DIR || mkdtempSync(join(tmpdir(), "excalidraw-obsidian-"));
const FORK_ARTIFACTS = ["excalidraw.production.min.js", "excalidraw.production.min.css",
  "excalidraw.development.js", "excalidraw.development.css"];

function command(file, args, cwd, timeout = 60_000, inherit = false) {
  const result = spawnSync(file, args, { cwd, encoding: "utf8", timeout, maxBuffer: 4 * 1024 * 1024,
    stdio: inherit ? "inherit" : "pipe" });
  if (result.error) throw new Error(`${file}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${file} ${args.join(" ")} failed (${result.status}): ${(result.stderr || result.stdout || "").trim().slice(0, 1000)}`);
  return result.stdout || "";
}

const git = (root, args) => command("git", args, root, 10_000).trim();
const source = {
  pluginRevision: git(pluginRoot, ["rev-parse", "HEAD"]),
  pluginDirty: Boolean(git(pluginRoot, ["status", "--porcelain"])),
  forkRevision: git(forkRoot, ["rev-parse", "HEAD"]),
  forkDirty: Boolean(git(forkRoot, ["status", "--porcelain"])),
  node: process.version,
  platform: process.platform,
};

const report = await runObsidianSmoke({
  projectRoot: pluginRoot,
  vaultName: process.env.EXCALIDRAW_TEST_VAULT_NAME,
  vaultPath: process.env.EXCALIDRAW_TEST_VAULT_PATH,
  configDir: process.env.EXCALIDRAW_TEST_CONFIG_DIR,
  reportDir,
  source,
  runCli: (vault, commandName, ...args) => command(process.env.EXCALIDRAW_OBSIDIAN_CLI || "obsidian",
    [`vault=${vault}`, commandName, ...args], pluginRoot),
  runBuild: () => {
    if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("Node.js 22 or newer is required");
    command("yarn", ["build:obsidian"], join(forkRoot, "packages/excalidraw"), 600_000, true);
    const sourceDir = join(forkRoot, "packages/excalidraw/dist/obsidian");
    const installedDir = join(pluginRoot, "node_modules/@zsviczian/excalidraw/dist/obsidian");
    if (!existsSync(join(pluginRoot, "node_modules/@zsviczian/excalidraw/package.json"))) {
      throw new Error("Install the plugin's declared dependencies before running the native lane");
    }
    for (const name of FORK_ARTIFACTS) {
      if (!existsSync(join(sourceDir, name))) throw new Error(`Fork build did not produce ${name}`);
    }
    mkdirSync(installedDir, { recursive: true });
    const hashes = {};
    for (const name of FORK_ARTIFACTS) {
      const sourcePath = join(sourceDir, name);
      copyFileSync(sourcePath, join(installedDir, name));
      const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
      const sourceHash = digest(sourcePath);
      if (sourceHash !== digest(join(installedDir, name))) throw new Error(`Fork artifact handoff changed ${name}`);
      hashes[name] = sourceHash;
    }
    command("npm", ["run", "build"], pluginRoot, 600_000, true);
    return hashes;
  },
});

console.log(`Obsidian smoke ${report.status}; report: ${join(reportDir, "report.json")}`);
if (report.error) console.error(report.error);
if (report.cleanupError) console.error(`Cleanup: ${report.cleanupError}`);
if (report.status !== "passed") process.exitCode = 1;
