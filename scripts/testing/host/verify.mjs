/** Build the plugin (optionally with the sibling fork), then run the guarded native smoke. */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { runObsidianSmoke } from "./runner.mjs";
import { obsidianCliExecutable, packageManagerInvocation, spawnNativeSync } from "./processTools.mjs";
import { runTextUndoScenario } from "./textUndo.mjs";
import { runNativeCLIScenario } from "./nativeCLI.mjs";
import { runEmbedRecoveryScenario } from "./embedRecovery.mjs";
import { runGroupedLinkClickScenario } from "./groupedLinkClick.mjs";
import { runLatexInputScenario } from "./latexInput.mjs";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const pluginOnly = process.argv.includes("--plugin-only");
const textUndo = process.argv.includes("--text-undo");
const nativeCLI = process.argv.includes("--native-cli");
const embedRecovery = process.argv.includes("--embed-recovery");
const groupedLinkClick = process.argv.includes("--grouped-link-click");
const latexInput = process.argv.includes("--latex-input");
const latexPreview = process.argv.includes("--latex-preview");
if (process.argv.slice(2).some(arg => !["--plugin-only", "--text-undo", "--native-cli", "--embed-recovery", "--grouped-link-click", "--latex-input", "--latex-preview"].includes(arg))) {
  throw new Error("Supported options: --plugin-only, --text-undo, --native-cli, --embed-recovery, --grouped-link-click, --latex-input, --latex-preview");
}
const forkRoot = resolve(process.env.EXCALIDRAW_FORK_ROOT || join(pluginRoot, "../excalidraw"));
const reportDir = process.env.EXCALIDRAW_TEST_REPORT_DIR || mkdtempSync(join(tmpdir(), "excalidraw-obsidian-"));
const FORK_ARTIFACTS = ["excalidraw.production.min.js", "excalidraw.production.min.css",
  "excalidraw.development.js", "excalidraw.development.css"];

function command(file, args, cwd, timeout = 60_000, inherit = false) {
  const result = spawnNativeSync(file, args, { cwd, encoding: "utf8", timeout, killSignal: "SIGKILL", maxBuffer: 4 * 1024 * 1024,
    stdio: inherit ? "inherit" : "pipe" });
  if (result.error) throw new Error(`${file}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${file} ${args.join(" ")} failed (${result.status}): ${(result.stderr || result.stdout || "").trim().slice(0, 1000)}`);
  return result.stdout || "";
}

const git = (root, args) => command("git", args, root, 10_000).trim();
const source = {
  pluginRevision: git(pluginRoot, ["rev-parse", "HEAD"]),
  pluginDirty: Boolean(git(pluginRoot, ["status", "--porcelain"])),
  ...(pluginOnly ? {} : {
    forkRevision: git(forkRoot, ["rev-parse", "HEAD"]),
    forkDirty: Boolean(git(forkRoot, ["status", "--porcelain"])),
  }),
  buildMode: pluginOnly ? "installed-package" : "local-fork",
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
  scenarios: [
    ...(textUndo ? [runTextUndoScenario] : []),
    ...(nativeCLI ? [runNativeCLIScenario] : []),
    ...(embedRecovery ? [runEmbedRecoveryScenario] : []),
    ...(groupedLinkClick ? [runGroupedLinkClickScenario] : []),
    ...(latexInput ? [runLatexInputScenario] : []),
    ...(latexPreview ? [context => runLatexInputScenario({ ...context, realRenderer: true })] : []),
  ],
  runCli: (vault, commandName, ...args) => command(obsidianCliExecutable(),
    [`vault=${vault}`, commandName, ...args], pluginRoot),
  runBuild: () => {
    if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("Node.js 22 or newer is required");
    const sourceDir = join(forkRoot, "packages/excalidraw/dist/obsidian");
    const installedDir = join(pluginRoot, "node_modules/@zsviczian/excalidraw/dist/obsidian");
    if (!existsSync(join(pluginRoot, "node_modules/@zsviczian/excalidraw/package.json"))) {
      throw new Error("Install the plugin's declared dependencies before running the native lane");
    }
    const installedPackage = JSON.parse(readFileSync(join(pluginRoot, "node_modules/@zsviczian/excalidraw/package.json"), "utf8"));
    const declaredPackage = JSON.parse(readFileSync(join(pluginRoot, "package.json"), "utf8")).dependencies["@zsviczian/excalidraw"];
    if (installedPackage.version !== declaredPackage) throw new Error("Installed Excalidraw package differs from the declared exact version; run npm install");
    source.componentVersion = installedPackage.version;
    if (!pluginOnly) {
      const yarn = packageManagerInvocation("yarn", ["build:obsidian"]);
      command(yarn.file, yarn.args, join(forkRoot, "packages/excalidraw"), 600_000, true);
      for (const name of FORK_ARTIFACTS) {
        if (!existsSync(join(sourceDir, name))) throw new Error(`Fork build did not produce ${name}`);
      }
      mkdirSync(installedDir, { recursive: true });
    }
    const hashes = {};
    for (const name of FORK_ARTIFACTS) {
      const sourcePath = join(pluginOnly ? installedDir : sourceDir, name);
      if (!existsSync(sourcePath)) throw new Error(`Installed package is missing ${name}; run npm install`);
      if (!pluginOnly) copyFileSync(sourcePath, join(installedDir, name));
      const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
      const sourceHash = digest(sourcePath);
      if (sourceHash !== digest(join(installedDir, name))) throw new Error(`Fork artifact handoff changed ${name}`);
      hashes[name] = sourceHash;
    }
    const npm = packageManagerInvocation("npm", ["run", "build"]);
    command(npm.file, npm.args, pluginRoot, 600_000, true);
    return hashes;
  },
});

const log = (message) => process.stdout.write(`${message}\n`);
log(`Obsidian smoke ${report.status}; report: ${join(reportDir, "report.json")}`);
if (report.error) console.error(report.error);
if (report.cleanupError) console.error(`Cleanup: ${report.cleanupError}`);
if (report.status !== "passed") process.exitCode = 1;
