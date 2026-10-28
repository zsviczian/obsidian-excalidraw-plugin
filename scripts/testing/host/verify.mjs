/** Build the plugin (optionally with the sibling fork), then run the guarded native smoke. */
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
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
import { runImageGeometryScenario } from "./imageGeometry.mjs";
import { runWheelZoomScenario } from "./wheelZoom.mjs";
import { runWebDropScenario } from "./webDrop.mjs";
import { runInternalDropScenario } from "./internalDrop.mjs";
import { runYouTubeDropScenario } from "./youtubeDrop.mjs";
import { runSvgImportScenario } from "./svgImport.mjs";
import { runLucideScenario } from "./lucideIcons.mjs";
import { runWorkflowFixesScenario } from "./workflowFixes.mjs";
import { acquireHostLock } from "./hostLock.mjs";
import { runDataIntegrityScenario } from "./dataIntegrity.mjs";
import { runLifecycleScenario } from './lifecycle.mjs';
import { runExtrasServicesScenario } from './extrasServices.mjs';
import { runStabilityScenario } from './stability.mjs';
import { runAutomateScenario } from './automate.mjs';
import { runCoreInteractionScenario } from './coreInteraction.mjs';
import { runDeviceMatrix } from './devices.mjs';
import { deviceProfiles, breakpointProfiles } from './deviceProfiles.mjs';
import { produceCombination, stageExtras } from './combination.mjs';
import { aggregateReports, adaptSmokeReport } from '../contracts.mjs';
import { writeReportFiles } from '../reportFiles.mjs';
import { writeFileSync } from 'node:fs';

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const profileArg = process.argv.slice(2).find(arg=>arg.startsWith('--profile='));
const profile = profileArg?.slice('--profile='.length);
if(profileArg !== undefined && !['smoke','full','devices','soak'].includes(profile))throw Error('Use --profile=smoke|full|devices|soak');
const fullProfile=profile==='full';
const lifecycle=fullProfile||process.argv.includes('--lifecycle');
const extrasServices=fullProfile||process.argv.includes('--extras-services');
const devices=fullProfile||profile==='devices'||process.argv.includes('--devices');
const pluginOnly = process.argv.includes("--plugin-only");
const textUndo = fullProfile || process.argv.includes("--text-undo");
const nativeCLI = fullProfile || process.argv.includes("--native-cli");
const embedRecovery = fullProfile || process.argv.includes("--embed-recovery");
const groupedLinkClick = fullProfile || process.argv.includes("--grouped-link-click");
const latexInput = fullProfile || process.argv.includes("--latex-input");
const latexPreview = process.argv.includes("--latex-preview");
const imageGeometryReal = fullProfile || process.argv.includes("--image-geometry-real");
const imageGeometry = process.argv.includes("--image-geometry") || imageGeometryReal;
const wheelZoom = fullProfile || process.argv.includes("--wheel-zoom");
const webDrop = process.argv.includes("--web-drop");
const internalDrop = process.argv.includes("--internal-drop");
const youtubeDrop = process.argv.includes("--youtube-drop");
const svgImport = process.argv.includes("--svg-import");
const lucide = fullProfile || process.argv.includes("--lucide");
const workflowFixes = fullProfile || process.argv.includes("--workflow-fixes");
const dataIntegrity = fullProfile || process.argv.includes("--data-integrity");
if (process.argv.slice(2).some(arg => arg !== profileArg && !["--lifecycle", "--extras-services", "--devices", "--data-integrity", "--workflow-fixes", "--plugin-only", "--lucide", "--text-undo", "--native-cli", "--embed-recovery", "--grouped-link-click", "--latex-input", "--latex-preview", "--image-geometry", "--image-geometry-real", "--wheel-zoom", "--web-drop", "--internal-drop", "--youtube-drop", "--svg-import"].includes(arg))) {
  throw new Error("Supported options: --data-integrity, --workflow-fixes, --plugin-only, --lucide, --text-undo, --native-cli, --embed-recovery, --grouped-link-click, --latex-input, --latex-preview, --image-geometry, --image-geometry-real, --wheel-zoom, --web-drop, --internal-drop, --youtube-drop, --svg-import");
}
if(profile && pluginOnly)throw Error("A frozen workspace profile cannot use --plugin-only");
const extrasRoot=resolve(process.env.EXCALIDRAW_EXTRAS_ROOT||join(pluginRoot,"../obsidian-excalidraw-extras"));
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
  buildMode: profile ? "workspace-frozen" : pluginOnly ? "installed-package" : "local-fork",
  node: process.version,
  platform: process.platform,
};

// One lock spans every CLI call, staging and scenario across all three repositories.
const userDataPath = process.env.EXCALIDRAW_TEST_USER_DATA_PATH || (process.platform === "win32"
  ? join(process.env.APPDATA || "", "obsidian")
  : process.platform === "darwin" ? join(homedir(), "Library/Application Support/obsidian")
  : join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "obsidian"));
const hostLock = acquireHostLock({ userDataPath });
let report, combination;
try {
report = await runObsidianSmoke({
  projectRoot: pluginRoot,
  vaultName: process.env.EXCALIDRAW_TEST_VAULT_NAME,
  vaultPath: process.env.EXCALIDRAW_TEST_VAULT_PATH,
  configDir: process.env.EXCALIDRAW_TEST_CONFIG_DIR,
  automationRoot: process.env.EXCALIDRAW_TEST_AUTOMATION_ROOT,
  reportDir,
  source,
  ownedDebugger:true,
  deployCompanions:profile?context=>stageExtras({combination,...context}):undefined,
  scenarios: [
    ...(lifecycle ? [runLifecycleScenario] : []),
    ...(extrasServices ? [runExtrasServicesScenario] : []),
    ...(dataIntegrity ? [runDataIntegrityScenario] : []),
    ...(workflowFixes ? [runWorkflowFixesScenario] : []),
    ...(lucide ? [runLucideScenario] : []),
    ...(svgImport ? [runSvgImportScenario] : []),
    ...(wheelZoom ? [runWheelZoomScenario] : []),
    ...(imageGeometry ? [context => runImageGeometryScenario({ ...context, realRenderer: imageGeometryReal })] : []),
    ...(webDrop ? [runWebDropScenario] : []),
    ...(internalDrop ? [runInternalDropScenario] : []),
    ...(youtubeDrop ? [runYouTubeDropScenario] : []),
    ...(textUndo ? [runTextUndoScenario] : []),
    ...(nativeCLI ? [runNativeCLIScenario] : []),
    ...(embedRecovery ? [runEmbedRecoveryScenario] : []),
    ...(groupedLinkClick ? [runGroupedLinkClickScenario] : []),
    ...(latexInput ? [runLatexInputScenario] : []),
    ...(latexPreview ? [context => runLatexInputScenario({ ...context, realRenderer: true })] : []),
    ...(fullProfile ? [runAutomateScenario] : []),
    ...(fullProfile ? [runCoreInteractionScenario] : []),
    ...(fullProfile || profile==='soak' ? [context=>runStabilityScenario({...context,cycles:profile==='soak'?25:6})] : []),
  ],
  runCli: (vault, commandName, ...args) => command(obsidianCliExecutable(),
    [`vault=${vault}`, commandName, ...args], pluginRoot),
  runBuild: () => {
    if(profile){
      combination=produceCombination({pluginRoot,forkRoot,extrasRoot,output:join(pluginRoot,'.test-work/frozen/combination-'+randomUUID())});
      return {pluginArtifactRoot:join(combination.output,'plugin'),forkArtifacts:Object.fromEntries(combination.manifests.fork.artifacts.filter(entry=>['production-js','production-css','development-js','development-css'].includes(entry.role)).map(entry=>[entry.role,entry.sha256])),combination};
    }
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
      const contracts = spawnNativeSync(process.execPath,
        [join(pluginRoot, "scripts/testing/hostContracts.test.mjs")], {
          cwd: pluginRoot, encoding: "utf8", timeout: 120_000,
          env: { ...process.env, EXCALIDRAW_TEST_FORK_TYPES_ROOT: forkRoot },
        });
      if (contracts.error || contracts.status !== 0) {
        throw new Error(`Local fork declaration contract failed: ${contracts.error?.message || contracts.stderr || contracts.stdout}`);
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
  if(devices && report.status==='passed'){
    const cli=(name,...args)=>command(obsidianCliExecutable(),[`vault=${process.env.EXCALIDRAW_TEST_VAULT_NAME}`,name,...args],pluginRoot);
    const deviceReport=await runDeviceMatrix({cli,reportDir:join(reportDir,'devices'),vaultName:process.env.EXCALIDRAW_TEST_VAULT_NAME,vaultPath:process.env.EXCALIDRAW_TEST_VAULT_PATH,configDir:process.env.EXCALIDRAW_TEST_CONFIG_DIR,automationRoot:process.env.EXCALIDRAW_TEST_AUTOMATION_ROOT,profiles:[...deviceProfiles(),...breakpointProfiles()]});
    const aggregate=aggregateReports([adaptSmokeReport(report),deviceReport],[]);aggregate.source=source;aggregate.combination=combination;
    writeFileSync(join(reportDir,'aggregate.json'),JSON.stringify(aggregate,null,2)+'\n');writeReportFiles(aggregate,reportDir);if(aggregate.status!=='passed')report.status='failed';
  }
} finally {
  hostLock.release();
}

const log = (message) => process.stdout.write(`${message}\n`);
log(`Obsidian smoke ${report.status}; report: ${join(reportDir, "report.json")}`);
if (report.error) console.error(report.error);
if (report.cleanupError) console.error(`Cleanup: ${report.cleanupError}`);
if (report.status !== "passed") process.exitCode = 1;
