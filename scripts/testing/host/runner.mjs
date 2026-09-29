/** Native Obsidian smoke lane for the exact locally built Excalidraw plugin. */
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, sep } from "node:path";

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
export function validateTarget({ vaultName, vaultPath, configDir }) {
  if (!vaultName || !vaultPath || !configDir) {
    throw new Error("Set EXCALIDRAW_TEST_VAULT_NAME, EXCALIDRAW_TEST_VAULT_PATH and EXCALIDRAW_TEST_CONFIG_DIR");
  }
  if (vaultName !== "excalidraw-test") throw new Error("This runner is restricted to the excalidraw-test vault");
  if (!isAbsolute(vaultPath) || !isAbsolute(configDir)) throw new Error("Vault and config paths must be absolute");
  if (!existsSync(vaultPath) || !existsSync(configDir)) throw new Error("Vault or config directory does not exist");
  const vault = realpathSync(vaultPath);
  const config = realpathSync(configDir);
  if (basename(vault) !== vaultName) throw new Error("Vault folder does not match the selected vault name");
  inside(vault, config, "Config directory");
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

const startCode = (name) => `(()=>{const p=app.plugins.plugins[${JSON.stringify(PLUGIN_ID)}];if(!p)return JSON.stringify({state:"failed",error:"plugin not loaded"});if(globalThis.${CONTROL})return JSON.stringify({state:"failed",error:"smoke controller already exists"});const c={state:"pending",name:${JSON.stringify(name)},path:null,error:null,cancel:false};globalThis.${CONTROL}=c;const extension=p.settings.compatibilityMode?".excalidraw":p.settings.useExcalidrawExtension?".excalidraw.md":".md";Promise.resolve(p.createAndOpenDrawing(c.name+extension,"new-tab")).then(async path=>{c.path=path;c.state="created";if(c.cancel){const file=app.vault.getFileByPath(path);if(file&&file.name.startsWith(${JSON.stringify(PREFIX)})){app.workspace.getLeavesOfType("excalidraw").find(l=>l.view.file?.path===path)?.detach();await app.vault.delete(file)}c.state="clean"}}).catch(error=>{c.error=String(error);c.state="failed"});return JSON.stringify({state:"started"})})()`;
const statusCode = `(()=>{const c=globalThis.${CONTROL};if(!c)return JSON.stringify({state:"missing"});const leaf=c.path&&app.workspace.getLeavesOfType("excalidraw").find(l=>l.view.file?.path===c.path);const view=leaf?.view;return JSON.stringify({state:c.state,path:c.path,error:c.error,ready:!!view?.excalidrawAPI,wrapper:!!view?.containerEl?.querySelector(".excalidraw-wrapper"),ownerMatches:!!view&&view.ownerDocument===view.containerEl.ownerDocument,mainWindow:!!view&&view.ownerDocument===app.workspace.containerEl?.ownerDocument})})()`;
const cleanupCode = `(()=>{const c=globalThis.${CONTROL};if(!c)return JSON.stringify({state:"clean"});if(c.state==="pending"){c.cancel=true;return JSON.stringify({state:"pending"})}if(c.state==="cleaning")return JSON.stringify({state:"cleaning"});const path=c.path;const file=path&&app.vault.getFileByPath(path);if(!file){delete globalThis.${CONTROL};return JSON.stringify({state:"clean"})}if(!file.name.startsWith(${JSON.stringify(PREFIX)}))return JSON.stringify({state:"failed",error:"refusing to delete a non-smoke drawing"});const leaf=app.workspace.getLeavesOfType("excalidraw").find(l=>l.view.file?.path===path);leaf?.detach();c.state="cleaning";Promise.resolve(app.vault.delete(file)).then(()=>{c.state="clean"},error=>{c.error=String(error);c.state="failed"});return JSON.stringify({state:"cleaning"})})()`;

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
export async function runObsidianSmoke({ projectRoot, vaultName, vaultPath, configDir, reportDir, runCli, runBuild,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now = () => Date.now(), source = {}, unique = () => randomUUID() }) {
  const report = { schemaVersion: 1, status: "failed", startedAt: new Date(now()).toISOString(), source,
    target: { vaultName, vaultPath, configDir }, capabilities: {}, artifacts: {}, scenarios: [], cleanup: "not-started" };
  mkdirSync(reportDir, { recursive: true });
  let phase = "preflight";
  let created = false;
  try {
    const target = validateTarget({ vaultName, vaultPath, configDir });
    const cli = (command, ...args) => {
      const output = runCli(vaultName, command, ...args);
      if (output.trim().startsWith("Error:")) throw new Error(`${command}: ${output.trim().slice(0, 500)}`);
      return output;
    };
    report.capabilities.version = cli("version").trim();
    const help = cli("help");
    const missing = REQUIRED_CLI.filter((command) => !help.includes(command));
    if (missing.length) throw new Error(`Obsidian CLI lacks: ${missing.join(", ")}`);
    const selected = cliPath(cli("vault", "info=path"));
    if (!existsSync(selected) || realpathSync(selected) !== target.vault) {
      throw new Error(`CLI selected vault ${selected}, expected ${target.vault}`);
    }
    report.target.vaultPath = target.vault;
    report.target.configDir = target.config;

    phase = "build";
    const forkArtifacts = await runBuild();
    const built = artifacts(projectRoot);
    report.artifacts = { forkArtifacts, version: built.version, sourceHashes: built.hashes,
      mainBytes: readFileSync(built.paths["main.js"]).length };

    phase = "deploy";
    if (existsSync(target.pluginDir)) cli("plugin:disable", `id=${PLUGIN_ID}`);
    mkdirSync(target.pluginDir, { recursive: true });
    for (const name of ARTIFACTS) copyFileSync(built.paths[name], join(target.pluginDir, name));
    report.artifacts.installedHashes = Object.fromEntries(ARTIFACTS.map((name) => [name, hash(join(target.pluginDir, name))]));
    if (ARTIFACTS.some((name) => built.hashes[name] !== report.artifacts.installedHashes[name])) {
      throw new Error("Installed artifacts differ from the local build");
    }
    cli("dev:errors", "clear");
    cli("plugin:enable", `id=${PLUGIN_ID}`);
    const loaded = await poll(() => parseEval(cli("eval", `code=JSON.stringify({state:app.plugins?.plugins?.[${JSON.stringify(PLUGIN_ID)}]?"loaded":"pending"})`)),
      (value) => value.state === "loaded", wait, now);
    if (loaded.state !== "loaded") throw new Error("Plugin did not load");
    await poll(() => ({ state: cli("commands", `filter=${PLUGIN_ID}`).includes(`${PLUGIN_ID}:excalidraw-autocreate`)
      ? "registered" : "pending" }), (value) => value.state === "registered", wait, now);
    report.scenarios.push({ id: "plugin-load", status: "passed" });

    phase = "drawing";
    const name = `${PREFIX}${unique()}`;
    const started = parseEval(cli("eval", `code=${startCode(name)}`));
    if (started.state !== "started") throw new Error(started.error || "Could not start drawing smoke");
    created = true;
    const drawing = await poll(() => parseEval(cli("eval", `code=${statusCode}`)),
      (value) => value.state === "created" && value.ready && value.wrapper && value.ownerMatches && value.mainWindow, wait, now);
    if (!drawing.path || !basename(drawing.path).startsWith(PREFIX)) throw new Error("Unexpected smoke drawing path");
    report.scenarios.push({ id: "drawing-main-window", status: "passed", assertions: ["Excalidraw API ready", "wrapper mounted", "owner document matches", "main application document"] });
    const errors = cli("dev:errors").trim();
    if (errors && !/^No errors captured\.?$/i.test(errors)) throw new Error(`Captured JavaScript errors: ${errors.slice(0, 1000)}`);
    report.scenarios.push({ id: "javascript-errors", status: "passed" });
    report.status = "passed";
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    report.scenarios.push({ id: phase, status: "failed", reason: report.error });
  } finally {
    if (created) {
      try {
        const cli = (code) => parseEval(runCli(vaultName, "eval", `code=${code}`));
        const response = cli(cleanupCode);
        if (response.state === "failed") throw new Error(response.error);
        await poll(() => cli(`(()=>JSON.stringify({state:globalThis.${CONTROL}?.state||"clean",error:globalThis.${CONTROL}?.error}))()`),
          (value) => value.state === "clean", wait, now);
        cli(`(()=>{delete globalThis.${CONTROL};return JSON.stringify({state:"clean"})})()`);
        report.cleanup = "passed";
      } catch (error) {
        report.cleanup = "failed";
        report.cleanupError = error instanceof Error ? error.message : String(error);
        report.status = "failed";
      }
    }
    report.completedAt = new Date(now()).toISOString();
    writeFileSync(join(reportDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}
