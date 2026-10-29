/** Native Obsidian smoke lane for the exact locally built Excalidraw plugin. */
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { validateOwnedVault } from "../provision.mjs";
import { adaptSmokeReport, ownedPath } from "../contracts.mjs";
import { acquireDebuggerSession, unexpectedConsoleErrors } from "./debuggerSession.mjs";
import { writeReportFiles } from "../reportFiles.mjs";
import {discoverStagedPlugin} from './pluginDiscovery.mjs';
import {acquireBrowserDiagnostics, classifyCLIErrorText, splitWindowErrors} from './browserDiagnostics.mjs';

export const PLUGIN_ID = "obsidian-excalidraw-plugin";
export const ARTIFACTS = ["main.js", "manifest.json", "styles.css"];
const REQUIRED_CLI = ["version", "vault", "plugin:enable", "plugin:disable", "commands", "eval", "dev:errors"];
const CONTROL = "__excalidrawCliSmoke";
const PREFIX = "__excalidraw_cli_smoke_";

const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

function inside(parent, child, label) {
  const rel = relative(parent, child);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`${label} must be inside the selected test vault`);
  }
}

/** Reject ambiguous or redirected vault and plugin paths before any deployment. */
export function validateTarget({ vaultName, vaultPath, configDir, automationRoot }) {
  if (!vaultName || !vaultPath || !configDir) {
    throw new Error("Set EXCALIDRAW_TEST_VAULT_NAME, EXCALIDRAW_TEST_VAULT_PATH and EXCALIDRAW_TEST_CONFIG_DIR");
  }
  const automation = vaultName !== "excalidraw-test";
  if (automation && !automationRoot) throw new Error("This runner is restricted to the excalidraw-test vault or an explicitly owned automation vault");
  if (!isAbsolute(vaultPath) || !isAbsolute(configDir)) throw new Error("Vault and config paths must be absolute");
  if (!existsSync(vaultPath) || !existsSync(configDir)) throw new Error("Vault or config directory does not exist");
  const vault = realpathSync(vaultPath);
  const config = realpathSync(configDir);
  inside(vault, config, "Config directory");
  ownedPath(vaultPath, relative(vaultPath, configDir).split(sep).join("/"));
  if (automation) {
    const owned = validateOwnedVault({ workRoot: automationRoot, vaultPath });
    if (owned.marker.vaultName !== vaultName || owned.config !== config) throw new Error("Automation vault identity/config differs");
  }
  if (basename(vault) !== vaultName) throw new Error("Vault folder does not match the selected vault name");
  if (!existsSync(join(config, "community-plugins.json"))) {
    throw new Error("Community plugins must be configured in this test vault");
  }
  const plugins = join(config, "plugins");
  if (existsSync(plugins) && lstatSync(plugins).isSymbolicLink()) throw new Error("Plugin directory cannot be a symlink");
  const pluginDir = join(plugins, PLUGIN_ID);
  if (existsSync(pluginDir) && lstatSync(pluginDir).isSymbolicLink()) throw new Error("Target plugin cannot be a symlink");
  for (const name of ARTIFACTS) {
    const file = join(pluginDir, name);
    if (existsSync(file) && lstatSync(file).isSymbolicLink()) throw new Error(`Target artifact cannot be a symlink: ${name}`);
  }
  const manifestPath = join(pluginDir, "manifest.json");
  if (!automation && (!existsSync(manifestPath) || JSON.parse(readFileSync(manifestPath, "utf8")).id !== PLUGIN_ID ||
    !JSON.parse(readFileSync(join(config, "community-plugins.json"), "utf8")).includes(PLUGIN_ID))) {
    throw new Error("Install and enable Excalidraw from Community plugins in excalidraw-test first");
  }
  return { vault, config, pluginDir };
}

function cliPath(output) {
  const path = output.trim();
  return path.startsWith("path ") ? path.slice(5).trim() : path;
}

function parseEval(output) {
  const value = output.trim().replace(/^=>\s*/, "");
  if (value.startsWith("Error:")) throw new Error(`Obsidian eval failed: ${value.slice(0, 500)}`);
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Obsidian eval returned non-JSON: ${value.slice(0, 500)}`);
  }
}

function artifacts(projectRoot) {
  const paths = Object.fromEntries(ARTIFACTS.map((name) => [name, join(projectRoot, "dist", name)]));
  for (const [name, path] of Object.entries(paths)) {
    if (!existsSync(path)) throw new Error(`Missing built ${name}: ${path}`);
  }
  const manifest = JSON.parse(readFileSync(paths["manifest.json"], "utf8"));
  if (manifest.id !== PLUGIN_ID) throw new Error(`Built manifest ID must be ${PLUGIN_ID}`);
  return { paths, hashes: Object.fromEntries(ARTIFACTS.map((name) => [name, hash(paths[name])])), version: manifest.version };
}

const startCode = (name) => `(()=>{const p=app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];let anchor;app.workspace.iterateAllLeaves(leaf=>{if(!anchor&&leaf.getRoot()===app.workspace.rootSplit)anchor=leaf});if(anchor){app.workspace.setActiveLeaf(anchor,{focus:true});app.workspace.containerEl.ownerDocument.defaultView.focus()}if(!p)return JSON.stringify({state:"failed",error:"plugin not loaded"});if(globalThis.${CONTROL})return JSON.stringify({state:"failed",error:"smoke controller already exists"});const c={state:"pending",name:${JSON.stringify(name)},path:null,error:null,cancel:false};globalThis.${CONTROL}=c;const extension=p.settings.compatibilityMode?".excalidraw":p.settings.useExcalidrawExtension?".excalidraw.md":".md";Promise.resolve(p.createAndOpenDrawing(c.name+extension,"new-tab","/")).then(async path=>{c.path=path;c.state="created";if(c.cancel){const file=app.vault.getFileByPath(path);if(file&&file.name.startsWith(${JSON.stringify(PREFIX)})){const leaf=app.workspace.getLeavesOfType("excalidraw").find(l=>l.view.file?.path===path);if(leaf){await leaf.setViewState({type:"empty",state:{}});leaf.detach()}await app.vault.delete(file)}c.state="clean"}}).catch(error=>{c.error=String(error);c.state="failed"});return JSON.stringify({state:"started"})})()`;
const statusCode = `(()=>{const c=globalThis.${CONTROL};if(!c)return JSON.stringify({state:"missing"});const leaf=c.path&&app.workspace.getLeavesOfType("excalidraw").find(l=>l.view.file?.path===c.path);const view=leaf?.view;return JSON.stringify({state:c.state,path:c.path,error:c.error,ready:!!view?.excalidrawAPI&&view.isLoaded&&!view.excalidrawAPI.getAppState().isLoading&&!view.semaphores.justLoaded&&!view.isClosingOrMigrating(),wrapper:!!view?.containerEl?.querySelector(".excalidraw-wrapper"),ownerMatches:!!view&&view.ownerDocument===view.containerEl.ownerDocument,mainWindow:!!view&&view.ownerDocument===app.workspace.containerEl?.ownerDocument})})()`;
const cleanupCode = `(()=>{const c=globalThis.${CONTROL};if(!c)return JSON.stringify({state:"clean"});if(c.state==="pending"){c.cancel=true;return JSON.stringify({state:"pending"})}if(c.state==="cleaning")return JSON.stringify({state:"cleaning"});const path=c.path;const file=path&&app.vault.getFileByPath(path);if(!file){delete globalThis.${CONTROL};return JSON.stringify({state:"clean"})}if(!file.name.startsWith(${JSON.stringify(PREFIX)}))return JSON.stringify({state:"failed",error:"refusing to delete a non-smoke drawing"});const leaf=app.workspace.getLeavesOfType("excalidraw").find(l=>l.view.file?.path===path);c.state="cleaning";(async()=>{if(leaf){const view=leaf.view;if(view.excalidrawAPI&&view.isDirty()){const saved=await view.saveWithOutcome();if(saved.status!=="persisted")throw Error("Owned drawing cleanup could not save")}}await app.vault.delete(file);if(leaf){const end=Date.now()+15000;while(leaf.view.getViewType()==="excalidraw"&&leaf.view.containerEl.isConnected){if(Date.now()>end)throw Error("Deleted owned drawing did not retire");await new Promise(resolve=>setTimeout(resolve,25))}if(leaf.view.containerEl.isConnected)leaf.detach()}c.state="clean"})().catch(error=>{c.error=String(error);c.state="failed"});return JSON.stringify({state:"cleaning"})})()`;

async function poll(read, acceptable, wait, now, timeoutMs = 20_000) {
  const deadline = now() + timeoutMs;
  for (;;) {
    const result = read();
    if (acceptable(result)) return result;
    if (result.state === "failed") throw new Error(result.error || "Host scenario failed");
    if (now() >= deadline) throw new Error(`Host scenario timed out: ${JSON.stringify(result)}`);
    await wait(250);
  }
}

/** Preflight, build, stage and exercise one disposable drawing; always write a report. */
export async function runObsidianSmoke({ projectRoot, vaultName, vaultPath, configDir, automationRoot, expectedUserDataPath, reportDir, runCli, runBuild,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now = () => Date.now(), source = {}, unique = () => randomUUID(), scenarios = [], ownedDebugger = false, deployCompanions, discoverPlugin=discoverStagedPlugin }) {
  reportDir = resolve(reportDir);
  const report = { schemaVersion: 1, status: "failed", startedAt: new Date(now()).toISOString(), source,
    target: { vaultName, vaultPath, configDir }, capabilities: {}, artifacts: {}, scenarios: [], cleanup: "not-started" };
  mkdirSync(reportDir, { recursive: true });
  let phase = "preflight";
  let created = false;
  let preserveOwnedFixtures = false;
  let debuggerSession, browserSession, ownedCli, companionCleanup;
  const expectedConsoleErrors = [];
  const cleanupDrawing = async () => {
    if(!created)return;
    const cli = code => parseEval(runCli(vaultName,'eval','code='+code));
    const response=cli(cleanupCode);if(response.state==='failed')throw Error(response.error);
    await poll(()=>cli(`(()=>JSON.stringify({state:globalThis.${CONTROL}?.state||"clean",error:globalThis.${CONTROL}?.error}))()`),value=>value.state==='clean',wait,now);
    cli(`(()=>{delete globalThis.${CONTROL};return JSON.stringify({state:"clean"})})()`);created=false;
  };
  try {
    const target = validateTarget({ vaultName, vaultPath, configDir, automationRoot });
    const cli = (command, ...args) => {
      const output = runCli(vaultName, command, ...args);
      if (output.trim().startsWith("Error:")) throw new Error(`${command}: ${output.trim().slice(0, 500)}`);
      return output;
    };
    ownedCli = cli;
    report.capabilities.version = cli("version").trim();
    const help = cli("help");
    const required=ownedDebugger?[...REQUIRED_CLI,"dev:debug","dev:cdp"]:REQUIRED_CLI;
    const missing = required.filter((command) => !help.includes(command));
    if (missing.length) throw new Error(`Obsidian CLI lacks: ${missing.join(", ")}`);
    const selected = cliPath(cli("vault", "info=path"));
    if (!existsSync(selected) || realpathSync(selected) !== target.vault) {
      throw new Error(`CLI selected vault ${selected}, expected ${target.vault}`);
    }
    report.target.vaultPath = target.vault;
    report.target.configDir = target.config;
    const selectedConfig = parseEval(cli("eval", "code=JSON.stringify({configDir:app.vault.configDir})")).configDir;
    if (typeof selectedConfig !== "string") throw new Error("CLI did not report its vault config directory");
    const hostConfig = join(target.vault, selectedConfig);
    if (!existsSync(hostConfig) || realpathSync(hostConfig) !== target.config) {
      throw new Error(`CLI config directory differs from ${target.config}`);
    }
    if(expectedUserDataPath){
      const actual=parseEval(cli('eval',"code=JSON.stringify(require('@electron/remote').app.getPath('userData'))"));
      if(typeof actual!=='string'||!existsSync(actual)||realpathSync(actual)!==realpathSync(expectedUserDataPath))throw Error('CLI application user-data identity differs from the held host lock');
      report.capabilities.applicationIdentity=realpathSync(actual);
    }
    if (ownedDebugger) { debuggerSession = acquireDebuggerSession(cli); report.capabilities.scheduling = debuggerSession.scheduling; }
    if (ownedDebugger) browserSession=acquireBrowserDiagnostics(cli,'native-main');
    if (ownedDebugger) report.capabilities.runtime = parseEval(cli("eval", "code=JSON.stringify({versions:require('process').versions,platform:require('process').platform,userAgent:navigator.userAgent})"));

    phase = "build";
    const buildResult = await runBuild();
    const forkArtifacts = buildResult?.forkArtifacts || buildResult;
    const built = artifacts(buildResult?.pluginArtifactRoot || projectRoot);
    if (buildResult?.combination) report.combination = buildResult.combination;
    report.artifacts = { forkArtifacts, version: built.version, sourceHashes: built.hashes,
      mainBytes: readFileSync(built.paths["main.js"]).length };

    phase = "deploy";
    if (existsSync(target.pluginDir)) cli("plugin:disable", `id=${PLUGIN_ID}`);
    if (deployCompanions) { const deployed = await deployCompanions({ cli, target }); report.artifacts.companions = deployed.evidence; companionCleanup = deployed.cleanup; }
    mkdirSync(target.pluginDir, { recursive: true });
    for (const name of ARTIFACTS) copyFileSync(built.paths[name], join(target.pluginDir, name));
    report.artifacts.installedHashes = Object.fromEntries(ARTIFACTS.map((name) => [name, hash(join(target.pluginDir, name))]));
    if (ARTIFACTS.some((name) => built.hashes[name] !== report.artifacts.installedHashes[name])) {
      throw new Error("Installed artifacts differ from the local build");
    }
    cli("dev:errors", "clear");
    report.capabilities.pluginDiscovery=await discoverPlugin(cli,PLUGIN_ID);
    cli("plugin:enable", `id=${PLUGIN_ID}`);
    const loaded = await poll(() => parseEval(cli("eval", `code=JSON.stringify({state:app.plugins?.plugins?.[${JSON.stringify(PLUGIN_ID)}]?"loaded":"pending"})`)),
      (value) => value.state === "loaded", wait, now);
    if (loaded.state !== "loaded") throw new Error("Plugin did not load");
    await poll(() => ({ state: cli("commands", `filter=${PLUGIN_ID}`).includes(`${PLUGIN_ID}:excalidraw-autocreate`)
      ? "registered" : "pending" }), (value) => value.state === "registered", wait, now);
    const runtime = parseEval(cli("eval", `code=JSON.stringify((()=>{const lib=app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}].getCLIRuntime();return {valid:typeof lib.Excalidraw==="object"&&typeof lib.loadSceneFonts==="function"&&typeof lib.exportToBlob==="function",protocol:lib.OBSIDIAN_EXCALIDRAW_HOST_PROTOCOL_VERSION}})())`));
    if (!runtime.valid || runtime.protocol !== 3) throw new Error("Plugin commands registered but its drawing runtime is unavailable or incompatible");
    report.scenarios.push({ id: "plugin-load", status: "passed", assertions: ["commands registered", "drawing/font/export runtime available", "host protocol 3"] });

    phase = "drawing";
    const name = `${PREFIX}${unique()}`;
    const started = parseEval(cli("eval", `code=${startCode(name)}`));
    if (started.state !== "started") throw new Error(started.error || "Could not start drawing smoke");
    created = true;
    let drawing = await poll(() => parseEval(cli("eval", `code=${statusCode}`)),
      (value) => value.state === "created" && value.ready && value.wrapper && value.ownerMatches && value.mainWindow, wait, now);
    if (!drawing.path || !basename(drawing.path).startsWith(PREFIX)) throw new Error("Unexpected smoke drawing path");
    report.target.drawingPath = drawing.path;
    report.target.fixturePaths = [drawing.path];
    report.scenarios.push({ id: "drawing-main-window", status: "passed", assertions: ["Excalidraw API ready", "wrapper mounted", "owner document matches", "main application document"] });
    const baselineErrors = cli("dev:errors").trim();
    report.baselineErrors=classifyCLIErrorText(baselineErrors);
    if (report.baselineErrors.unexpected.length) throw Error("Native error baseline failed before feature tests: " + baselineErrors.slice(0, 1000));
    if(browserSession){report.baselineIdle=await browserSession.settle();if(report.baselineIdle.status!=='passed')throw Error(report.baselineIdle.reason);}
    report.capabilities.errorBaseline = "passed";
    phase = "feature-scenarios";
    for (const [index,scenario] of scenarios.entries()) {
      if(index>0){
        await cleanupDrawing();
        const next=parseEval(cli('eval','code='+startCode(name+'_case'+index)));
        if(next.state!=='started')throw Error(next.error||'Next scenario fixture did not start');created=true;
        drawing=await poll(()=>parseEval(cli('eval','code='+statusCode)),value=>value.state==='created'&&value.ready&&value.wrapper&&value.ownerMatches&&value.mainWindow,wait,now);
        if(!drawing.path||!basename(drawing.path).startsWith(PREFIX))throw Error('Unexpected scenario drawing path');
        report.target.fixturePaths.push(drawing.path);
      }
      report.target.drawingPath=drawing.path;
      browserSession?.setLabel('scenario:'+index);
      let result;
      try {result = await scenario({ cli, drawingPath: drawing.path, reportDir });}
      catch(error){
        if(error.cleanupVerified!==true)throw error;
        result={id:scenario.name||'scenario:'+index,status:'failed',reason:error.message,cleanup:'passed',...(error.evidence?.length?{tests:error.evidence}:{}),observations:error.observations};
      }
      report.scenarios.push(result);
      browserSession?.setLabel(result.id);
      if(browserSession){result.settlingCheck=await browserSession.settle();if(result.settlingCheck.status!=='passed'){result.status='failed';result.reason=result.settlingCheck.reason;}}
      expectedConsoleErrors.push(...(result.expectedConsoleErrors || []));
      if (result.status !== "passed") {
        report.error ||= `Required native scenario ${result.id} is ${result.status}: ${result.reason || "no reason supplied"}`;
        // Returned scenarios have completed their cleanup. Keep independent
        // failures visible while continuing; never continue unsettled work.
        if(ownedDebugger){const pending=parseEval(cli('eval',"code=JSON.stringify(Object.keys(globalThis).some(key=>key.startsWith('__excalidrawTestTask_'))||[app.workspace.containerEl.ownerDocument,...app.workspace.floatingSplit.children.map(win=>win.doc)].some(doc=>doc?.querySelector('body > .print')))"));if(pending){const error=Error('Failed scenario still owns native work');error.cleanupFailed=true;throw error;}}
      }
    }
    const errors = cli("dev:errors").trim();
    report.cliErrors=classifyCLIErrorText(errors);
    if (report.cliErrors.unexpected.length) throw new Error(`Captured JavaScript errors: ${errors.slice(0, 1000)}`);
    report.scenarios.push({ id: "javascript-errors", status: "passed" });
    report.status = report.scenarios.every(scenario=>scenario.status==='passed')?'passed':'failed';
  } catch (error) {
    preserveOwnedFixtures = error?.cleanupFailed === true;
    report.error = error instanceof Error ? error.message : String(error);
    if (error?.evidence) report.failedTaskEvidence = error.evidence;
    if (error?.observations) report.failedTaskObservations = error.observations;
    report.scenarios.push({ id: phase, status: "failed", reason: report.error, ...(error?.evidence?.length ? {tests:error.evidence} : {}) });
  } finally {
    if (created && preserveOwnedFixtures) {
      report.cleanup = "failed";
      report.cleanupError = "Unsettled or leaked native task; fixtures preserved for guarded recovery";
    } else if (created) {
      try {
        await cleanupDrawing();
        report.cleanup = "passed";
      } catch (error) {
        report.cleanup = "failed";
        report.cleanupError = error instanceof Error ? error.message : String(error);
        report.status = "failed";
      }
    }
    // Unsettled Electron work still owns its services and resources. Tooling
    // cannot unload a companion as if a deadline had cancelled native printing.
    if (companionCleanup && !preserveOwnedFixtures) { try { await companionCleanup(); } catch(error) { report.status="failed"; report.cleanup="failed"; report.cleanupError=String(error); } }
    if (debuggerSession) {
      try {
        if(browserSession){report.cleanupIdle=await browserSession.settle();if(report.cleanupIdle.status!=='passed'){report.status='failed';report.error||=report.cleanupIdle.reason;}}
        report.consoleErrors = [...debuggerSession.read(), ...report.scenarios.flatMap(s=>s.consoleErrors||[])];
        report.unexpectedConsoleErrors = unexpectedConsoleErrors(report.consoleErrors, expectedConsoleErrors);
        if (report.unexpectedConsoleErrors.length) { report.status = "failed"; report.error ||= "Unexpected console/JavaScript errors after native cleanup"; }
        const errors = ownedCli("dev:errors").trim();
        report.cleanupCLIErrors=classifyCLIErrorText(errors);
        if (report.cleanupCLIErrors.unexpected.length) { report.status = "failed"; report.error ||= `Captured JavaScript errors after cleanup: ${errors.slice(0, 1000)}`; }
        if(browserSession){report.windowErrors=browserSession.read();report.browserDiagnostics=splitWindowErrors(report.windowErrors);if(report.browserDiagnostics.unexpected.length){report.status='failed';report.error||='Unexpected browser window errors';}}
      } catch (error) { report.status = "failed"; report.error ||= error.message; }
      finally {
        try { browserSession?.dispose(); } catch(error){report.status='failed';report.cleanup='failed';report.cleanupError=error.message;}
        try { debuggerSession.dispose(); }
        catch (error) { report.status = "failed"; report.cleanup = "failed"; report.cleanupError = error.message; }
      }
    }
    report.completedAt = new Date(now()).toISOString();
    writeFileSync(join(reportDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    const normalized = adaptSmokeReport(report);
    writeFileSync(join(reportDir, "report-v2.json"), JSON.stringify(normalized, null, 2) + "\n");
    writeReportFiles(normalized, reportDir);
  }
  return report;
}
