/** Prepare the repository-local vault from current workspace builds, then run guarded native profiles. */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runObsidianSmoke } from "./runner.mjs";
import { obsidianCliExecutable, spawnNativeSync } from "./processTools.mjs";
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
import { runLifecycleScenario } from "./lifecycle.mjs";
import { runExtrasServicesScenario } from "./extrasServices.mjs";
import { runStabilityScenario } from "./stability.mjs";
import { runAutomateScenario } from "./automate.mjs";
import { runCoreInteractionScenario } from "./coreInteraction.mjs";
import { runPDFImportScenario } from "./pdfImport.mjs";
import { runDeviceMatrix } from "./devices.mjs";
import { deviceProfiles, breakpointProfiles } from "./deviceProfiles.mjs";
import { produceCombination, stageExtras } from "./combination.mjs";
import {
  aggregateReports,
  adaptSmokeReport,
  sourceIdentity,
} from "../contracts.mjs";
import { writeReportFiles } from "../reportFiles.mjs";
import { writeFileSync } from "node:fs";
import {
  configureLocalVaultEnvironment,
  prepareLocalVault,
  restoreLocalVaultBaseline,
} from "../localVault.mjs";
import { runBehaviorMatrix } from "./behaviorMatrix.mjs";
import { runErrorOracle } from "./errorOracle.mjs";
import {requiredNativeCases,requiredDeviceCases} from '../regression.mjs';

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const target = configureLocalVaultEnvironment(pluginRoot);
const prepareOnly = process.argv.includes("--prepare-only");
const diagnostics = process.argv.includes("--diagnostics") || process.argv.some(arg=>['--profile=full','--profile=regression'].includes(arg));
const profileArg = process.argv
  .slice(2)
  .find((arg) => arg.startsWith("--profile="));
const profile = profileArg?.slice("--profile=".length);
if (
  profileArg !== undefined &&
  !["smoke", "regression", "full", "devices", "soak"].includes(profile)
)
  throw Error("Use --profile=smoke|regression|full|devices|soak");
const fullProfile = profile === "full" || profile === "regression";
const coreOnly=process.argv.includes("--core"),coreScenarios=fullProfile||coreOnly;
const lifecycle = coreScenarios || process.argv.includes("--lifecycle");
const migrationComparison = process.argv.includes("--migration-comparison");
if (fullProfile && migrationComparison)
  throw Error("Migration comparison is a focused diagnostic, not a full-profile replacement");
const extrasServices =
  coreScenarios || process.argv.includes("--extras-services");
const devices =
  fullProfile || profile === "devices" || process.argv.includes("--devices");
const textUndo = coreScenarios || process.argv.includes("--text-undo");
const stability = coreScenarios || profile === "soak" || process.argv.includes("--stability");
const nativeCLI = coreScenarios || process.argv.includes("--native-cli");
const embedRecovery = coreScenarios || process.argv.includes("--embed-recovery");
const groupedLinkClick =
  coreScenarios || process.argv.includes("--grouped-link-click");
const latexInput = coreScenarios || process.argv.includes("--latex-input");
const latexPreview = process.argv.includes("--latex-preview");
const imageGeometryReal =
  coreScenarios || process.argv.includes("--image-geometry-real");
const imageGeometry =
  process.argv.includes("--image-geometry") || imageGeometryReal;
const wheelZoom = coreScenarios || process.argv.includes("--wheel-zoom");
const webDrop = coreScenarios || process.argv.includes("--web-drop");
const internalDrop = coreScenarios || process.argv.includes("--internal-drop");
const youtubeDrop = process.argv.includes("--youtube-drop");
const svgImport = process.argv.includes("--svg-import");
const lucide = coreScenarios || process.argv.includes("--lucide");
const workflowFixes = coreScenarios || process.argv.includes("--workflow-fixes");
const behaviorMatrix =
  fullProfile || process.argv.includes("--behavior-matrix");
const dataIntegrity = coreScenarios || process.argv.includes("--data-integrity");
const focusContextArg = process.argv
  .slice(2)
  .find((arg) => arg.startsWith("--behavior-context="));
const focusCasesArg = process.argv
  .slice(2)
  .find((arg) => arg.startsWith("--behavior-cases="));
if (fullProfile && (focusContextArg || focusCasesArg))
  throw Error(
    "Full/regression profiles cannot omit behavioral cases or contexts",
  );
const focusedContexts = focusContextArg
  ?.slice("--behavior-context=".length)
  .split(",");
const focusedCases = focusCasesArg
  ?.slice("--behavior-cases=".length)
  .split(",");
const deviceProfilesArg=process.argv.slice(2).find(arg=>arg.startsWith('--device-profiles='));
const allDeviceProfiles=[...deviceProfiles(),...breakpointProfiles()];
const selectedDeviceIds=deviceProfilesArg?.slice('--device-profiles='.length).split(',');
if(fullProfile&&deviceProfilesArg)throw Error('Full/regression profiles cannot omit device profiles');
if(selectedDeviceIds?.some(id=>!allDeviceProfiles.some(profile=>profile.id===id)))throw Error('Unknown focused device profile');
if (
  focusedContexts?.some(
    (id) => !["main", "split", "nested-split", "popout"].includes(id),
  )
)
  throw Error("Focused desktop contexts: main,split,nested-split,popout");
const flags = [
  "--diagnostics",
  "--core",
  "--prepare-only",
  "--behavior-matrix",
  "--lifecycle",
  "--migration-comparison",
  "--extras-services",
  "--devices",
  "--data-integrity",
  "--workflow-fixes",
  "--lucide",
  "--text-undo",
  "--stability",
  "--native-cli",
  "--embed-recovery",
  "--grouped-link-click",
  "--latex-input",
  "--latex-preview",
  "--image-geometry",
  "--image-geometry-real",
  "--wheel-zoom",
  "--web-drop",
  "--internal-drop",
  "--youtube-drop",
  "--svg-import",
];
const unknown = process.argv
  .slice(2)
  .filter(
    (arg) =>
      ![profileArg, focusContextArg, focusCasesArg, deviceProfilesArg, ...flags].includes(arg),
  );
if (unknown.length)
  throw Error(
    "Unsupported options: " +
      unknown.join(", ") +
      ". Native runs always build current workspace producers. Available: " +
      flags.join(", "),
  );

const extrasRoot = resolve(
  process.env.EXCALIDRAW_EXTRAS_ROOT ||
    join(pluginRoot, "../obsidian-excalidraw-extras"),
);
const forkRoot = resolve(
  process.env.EXCALIDRAW_FORK_ROOT || join(pluginRoot, "../excalidraw"),
);
const reportDir =
  process.env.EXCALIDRAW_TEST_REPORT_DIR ||
  join(pluginRoot, ".test-work/reports/native-" + randomUUID());

if(existsSync(join(reportDir,'report.json'))||existsSync(join(reportDir,'preparation.json')))throw Error('Choose a new native report directory; previous evidence must not be overwritten');

function command(file, args, cwd, timeout = 60_000, inherit = false) {
  const result = spawnNativeSync(file, args, {
    cwd,
    encoding: "utf8",
    timeout,
    killSignal: "SIGKILL",
    maxBuffer: 4 * 1024 * 1024,
    stdio: inherit ? "inherit" : "pipe",
  });
  if (result.error) throw new Error(`${file}: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(
      `${file} ${args.join(" ")} failed (${result.status}): ${(result.stderr || result.stdout || "").trim().slice(0, 1000)}`,
    );
  return result.stdout || "";
}

const git = (root, args) => command("git", args, root, 10_000).trim();
const source = {
  pluginRevision: git(pluginRoot, ["rev-parse", "HEAD"]),
  pluginDirty: Boolean(git(pluginRoot, ["status", "--porcelain"])),
  forkRevision: git(forkRoot, ["rev-parse", "HEAD"]),
  forkDirty: Boolean(git(forkRoot, ["status", "--porcelain"])),
  buildMode: "workspace-frozen",
  requestedProfile: coreOnly ? "core" : profile || "focused",
  node: process.version,
  platform: process.platform,
};

// One lock spans every CLI call, staging and scenario across all three repositories.
const userDataPath =
  process.env.EXCALIDRAW_TEST_USER_DATA_PATH ||
  (process.platform === "win32"
    ? join(process.env.APPDATA || "", "obsidian")
    : process.platform === "darwin"
      ? join(homedir(), "Library/Application Support/obsidian")
      : join(
          process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
          "obsidian",
        ));
const hostLock = acquireHostLock({ userDataPath });
let report, combination, deviceReport;
try {
  combination = produceCombination({
    pluginRoot,
    forkRoot,
    extrasRoot,
    output: join(pluginRoot, ".test-work/frozen/combination-" + randomUUID()),
  });
  const localCLI = (name, ...args) =>
    command(
      obsidianCliExecutable(),
      [`vault=${target.vaultName}`, name, ...args],
      pluginRoot,
    );
  const preparation = await prepareLocalVault({
    projectRoot: pluginRoot,
    combination,
    userDataPath,
    cli: localCLI,
  });
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(
    join(reportDir, "preparation.json"),
    JSON.stringify(preparation, null, 2) + "\n",
  );
  if (!combination.manifests.extras && !prepareOnly)
    throw Error(
      "Workspace Extras is missing. The local plugin installation is prepared, but Extras-dependent coverage remains unfinished.",
    );
  if (prepareOnly || !preparation.ready) {
    process.stdout.write(
      JSON.stringify({ status: "prepared", ...preparation }, null, 2) + "\n",
    );
    if (!preparation.ready && !prepareOnly) process.exitCode = 2;
  } else {
    report = await runObsidianSmoke({
      projectRoot: pluginRoot,
      vaultName: process.env.EXCALIDRAW_TEST_VAULT_NAME,
      vaultPath: process.env.EXCALIDRAW_TEST_VAULT_PATH,
      configDir: process.env.EXCALIDRAW_TEST_CONFIG_DIR,
      automationRoot: process.env.EXCALIDRAW_TEST_AUTOMATION_ROOT,
      expectedUserDataPath: userDataPath,
      reportDir,
      source,
      ownedDebugger: true,
      deployCompanions: (context) => stageExtras({ combination, ...context }),
      scenarios: [
        ...(behaviorMatrix
          ? [
              (context) =>
                runBehaviorMatrix({
                  ...context,
                  ...(focusedContexts ? { contexts: focusedContexts } : {}),
                  ...(focusedCases ? { caseIds: focusedCases } : {}),
                }),
            ]
          : []),
        ...(lifecycle ? [runLifecycleScenario] : []),
        ...(migrationComparison ? [
          context => runLifecycleScenario(context),
          context => runLifecycleScenario(context, { migrationRoute: "host-drag" }),
        ] : []),
        ...(extrasServices ? [runExtrasServicesScenario] : []),
        ...(dataIntegrity ? [runDataIntegrityScenario] : []),
        ...(workflowFixes ? [runWorkflowFixesScenario] : []),
        ...(svgImport ? [runSvgImportScenario] : []),
        ...(wheelZoom ? [runWheelZoomScenario] : []),
        ...(imageGeometry
          ? [
              (context) =>
                runImageGeometryScenario({
                  ...context,
                  realRenderer: imageGeometryReal,
                }),
            ]
          : []),
        ...(webDrop
          ? [
              (context) =>
                runWebDropScenario({ ...context, includePopout: true }),
            ]
          : []),
        ...(internalDrop
          ? [
              (context) =>
                runInternalDropScenario({ ...context, includePopout: true }),
            ]
          : []),
        ...(youtubeDrop ? [runYouTubeDropScenario] : []),
        ...(textUndo ? [runTextUndoScenario] : []),
        ...(nativeCLI ? [runNativeCLIScenario] : []),
        ...(embedRecovery ? [runEmbedRecoveryScenario] : []),
        ...(groupedLinkClick ? [runGroupedLinkClickScenario] : []),
        ...(latexInput ? [runLatexInputScenario] : []),
        ...(latexPreview
          ? [
              (context) =>
                runLatexInputScenario({ ...context, realRenderer: true }),
            ]
          : []),
        ...(coreScenarios ? [runAutomateScenario] : []),
        ...(coreScenarios ? [runCoreInteractionScenario] : []),
        ...(coreScenarios ? [runPDFImportScenario] : []),
        ...(stability
          ? [
              (context) =>
                runStabilityScenario({
                  ...context,
                  cycles: profile === "soak" ? 25 : 6,
                }),
            ]
          : []),
        // The catalogue/picker workflow runs after independent core scenarios.
        ...(lucide ? [runLucideScenario] : []),
      ],
      runCli: (vault, commandName, ...args) =>
        command(
          obsidianCliExecutable(),
          [`vault=${vault}`, commandName, ...args],
          pluginRoot,
        ),
      runBuild: () => ({
        pluginArtifactRoot: join(combination.output, "plugin"),
        forkArtifacts: Object.fromEntries(
          combination.manifests.fork.artifacts
            .filter((entry) =>
              [
                "production-js",
                "production-css",
                "development-js",
                "development-css",
              ].includes(entry.role),
            )
            .map((entry) => [entry.role, entry.sha256]),
        ),
        combination,
      }),
    });
    // A completed functional run can retain an error-gate failure while device
    // cases execute independently. Unsettled cleanup must never enter this lane.
    if (devices && report.cleanup === "passed") {
      const cli = (name, ...args) =>
        command(
          obsidianCliExecutable(),
          [`vault=${process.env.EXCALIDRAW_TEST_VAULT_NAME}`, name, ...args],
          pluginRoot,
        );
      deviceReport = await runDeviceMatrix({
        cli,
        reportDir: join(reportDir, "devices"),
        vaultName: process.env.EXCALIDRAW_TEST_VAULT_NAME,
        vaultPath: process.env.EXCALIDRAW_TEST_VAULT_PATH,
        configDir: process.env.EXCALIDRAW_TEST_CONFIG_DIR,
        automationRoot: process.env.EXCALIDRAW_TEST_AUTOMATION_ROOT,
        profiles: selectedDeviceIds ? allDeviceProfiles.filter(profile=>selectedDeviceIds.includes(profile.id)) : allDeviceProfiles,
        featureWorkflows: fullProfile || profile === "devices",
        featureCases:focusedCases,
      });
      deviceReport.source = combination?.manifests.plugin || source;
      deviceReport.artifacts = report.artifacts.installedHashes;
      writeFileSync(
        join(reportDir, "devices/report.json"),
        JSON.stringify(deviceReport, null, 2) + "\n",
      );
    } else if (devices) {
      const reason =
        "Parent native cleanup did not complete; device work is blocked to preserve owned resources";
      deviceReport = {
        schemaVersion: 2,
        suiteId: "native-devices",
        status: "blocked",
        cleanup: "not-started",
        source: combination?.manifests.plugin || source,
        tests: [...deviceProfiles(), ...breakpointProfiles()].map(
          (profile) => ({
            testId: "native:device:" + profile.id,
            featureIds: ["P07", "P08"],
            status: "blocked",
            reason,
          }),
        ),
      };
      mkdirSync(join(reportDir, "devices"), { recursive: true });
      writeFileSync(
        join(reportDir, "devices/report.json"),
        JSON.stringify(deviceReport, null, 2) + "\n",
      );
      writeReportFiles(deviceReport, join(reportDir, "devices"));
    }
    if (combination) {
      try {
        for (const [kind, manifest] of Object.entries(combination.manifests)) {
          const after = sourceIdentity(combination.roots[kind]);
          if (
            ["commit", "dirty", "diffHash", "lockfileHash"].some(
              (key) => after[key] !== manifest[key],
            )
          )
            throw Error(kind + " source changed during native verification");
        }
        report.scenarios.push({ id: "source-stability", status: "passed" });
      } catch (error) {
        report.status = "failed";
        report.error ||= error.message;
        report.scenarios.push({
          id: "source-stability",
          status: "failed",
          reason: error.message,
        });
      }
    }
    if (
      report.cleanup === "passed" &&
      (!deviceReport || deviceReport.cleanup === "passed")
    ) {
      if (diagnostics) {
        const oracle = await runErrorOracle({
          cli: localCLI,
          reportDir: join(reportDir, "error-oracle"),
          source: combination.manifests.plugin,
        });
        if (oracle.status !== "passed") {
          report.status = "failed";
          report.error = "Actual unhandled-error negative control failed";
        }
      }
      try {
        report.baselineRestoration = await restoreLocalVaultBaseline({
          projectRoot: pluginRoot,
          cli: localCLI,
        });
      } catch (error) {
        report.status = "failed";
        report.cleanup = "failed";
        report.cleanupError = String(error.stack || error);
      }
    }
    if(coreOnly){const audit=aggregateReports([adaptSmokeReport(report)],requiredNativeCases.filter(id=>!id.startsWith('native:behavior:')));report.coreAudit={status:audit.status,missing:audit.missing};if(audit.status!=='passed')report.status='failed';}
    writeFileSync(
      join(reportDir, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    const normalized = adaptSmokeReport(report);
    writeFileSync(
      join(reportDir, "report-v2.json"),
      JSON.stringify(normalized, null, 2) + "\n",
    );
    writeReportFiles(normalized, reportDir);
    if (deviceReport) {
      const aggregate = aggregateReports(
        [adaptSmokeReport(report), deviceReport],
        fullProfile ? [...requiredNativeCases,...requiredDeviceCases] : [],
      );
      aggregate.source = source;
      aggregate.combination = combination;
      writeFileSync(
        join(reportDir, "aggregate.json"),
        JSON.stringify(aggregate, null, 2) + "\n",
      );
      writeReportFiles(aggregate, reportDir);
      if (aggregate.status !== "passed") report.status = "failed";
      writeFileSync(join(reportDir,'report.json'),JSON.stringify(report,null,2)+'\n');
    }
  }
} finally {
  hostLock.release();
}

const log = (message) => process.stdout.write(`${message}\n`);
if (report) {
  log(
    `Obsidian smoke ${report.status}; report: ${join(reportDir, "report.json")}`,
  );
  if (report.error) console.error(report.error);
  if (report.cleanupError) console.error(`Cleanup: ${report.cleanupError}`);
  if (report.status !== "passed") process.exitCode = 1;
}
