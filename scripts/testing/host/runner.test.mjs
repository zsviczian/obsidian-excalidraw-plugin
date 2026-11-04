import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { rmSync } from "node:fs";
import { runObsidianSmoke, validateTarget } from "./runner.mjs";

const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "excalidraw-runner-test-"));
  roots.push(root);
  const vaultPath = join(root, "excalidraw-test");
  const configDir = join(vaultPath, ".obsidian");
  const projectRoot = join(root, "plugin");
  const reportDir = join(root, "reports");
  mkdirSync(configDir, { recursive: true });
  mkdirSync(join(projectRoot, "dist"), { recursive: true });
  writeFileSync(join(configDir, "community-plugins.json"), '["obsidian-excalidraw-plugin"]');
  const pluginDir = join(configDir, "plugins/obsidian-excalidraw-plugin");
  mkdirSync(pluginDir, { recursive: true });
  writeFileSync(join(pluginDir, "manifest.json"), JSON.stringify({ id: "obsidian-excalidraw-plugin" }));
  writeFileSync(join(projectRoot, "dist/main.js"), "// smoke build");
  writeFileSync(join(projectRoot, "dist/styles.css"), "/* smoke */");
  writeFileSync(join(projectRoot, "dist/manifest.json"), JSON.stringify({ id: "obsidian-excalidraw-plugin", version: "test" }));
  return { vaultName: "excalidraw-test", vaultPath, configDir, projectRoot, reportDir };
}

test("requires the named test vault and refuses redirected plugin paths", () => {
  const input = fixture();
  assert.ok(validateTarget(input).pluginDir.endsWith("obsidian-excalidraw-plugin"));
  assert.throws(() => validateTarget({ ...input, vaultName: "personal-notes" }), /restricted/);
  assert.throws(() => validateTarget({ ...input, configDir: input.projectRoot }), /inside/);
});

test("a CLI vault mismatch stops before build or staging", async () => {
  const input = fixture();
  let built = false;
  const report = await runObsidianSmoke({ ...input, runBuild: () => { built = true; },
    runCli: (_vault, command) => command === "help" ? "version vault plugin:enable plugin:disable commands eval dev:errors" :
      command === "vault" ? input.projectRoot : "1.13.0" });
  assert.equal(report.status, "failed");
  assert.match(report.error, /CLI selected vault/);
  assert.equal(built, false);
  assert.equal(JSON.parse(readFileSync(join(input.reportDir, "report.json"))).status, "failed");
});

test("requires the initial Community plugin install and enablement", () => {
  const input = fixture();
  writeFileSync(join(input.configDir, "community-plugins.json"), "[]");
  assert.throws(() => validateTarget(input), /Install and enable Excalidraw/);
});

test("a CLI config mismatch stops before build or deployment", async () => {
  const input = fixture();
  let built = false;
  const report = await runObsidianSmoke({ ...input, runBuild: () => { built = true; },
    runCli: (_vault, command) => command === "help" ? "version vault plugin:enable plugin:disable commands eval dev:errors" :
      command === "vault" ? input.vaultPath : command === "eval" ? '{"configDir":".different"}' : "1.14.0" });
  assert.equal(built, false);
  assert.equal(report.status, "failed");
  assert.match(report.error, /CLI config directory differs/);
});

test("stages exact artifacts, asserts an editor and cleans its test drawing", async () => {
  const input = fixture();
  const commands = [];
  let cleanupStarted = false;
  let commandReads = 0, activeDrawing="__excalidraw_cli_smoke_1.excalidraw.md";
  const runCli = (_vault, command, ...args) => {
    commands.push(command);
    // A future alpha label is report metadata, never an acceptance allowlist.
    if (command === "version") return "1.99.0-alpha.3";
    if (command === "help") return "version vault plugin:enable plugin:disable commands eval dev:errors";
    if (command === "vault") return input.vaultPath;
    if (command === "commands") {
      commandReads++;
      return commandReads > 1 ? "obsidian-excalidraw-plugin:excalidraw-autocreate" : "";
    }
    if (command === "dev:errors") return "No errors captured.";
    if (command === "eval") {
      const code = args[0];
      if (code.includes("getCLIRuntime")) return '{"valid":true,"protocol":4}';
      if (code.includes("app.vault.configDir")) return '{"configDir":".obsidian"}';
      if (code.includes("createAndOpenDrawing")) {
        activeDrawing=code.includes("_case1")?"__excalidraw_cli_smoke_1_case1.excalidraw.md":"__excalidraw_cli_smoke_1.excalidraw.md";
        assert.ok(code.includes("useExcalidrawExtension"));
        assert.ok(code.includes('"new-tab","/"'));
        return '=> {"state":"started"}';
      }
      if (code.includes("app.vault.delete")) {
        assert.ok(code.indexOf("await view.saveWithOutcome()")<code.indexOf("await app.vault.delete(file)"));
        assert.ok(code.indexOf("await app.vault.delete(file)")<code.indexOf("Deleted owned drawing did not retire"));
        cleanupStarted = true;
        return '{"state":"cleaning"}';
      }
      if (code.includes("?.state||")) return cleanupStarted ? '{"state":"clean"}' : '{"state":"created"}';
      if (code.includes("delete globalThis.__excalidrawCliSmoke")) return '{"state":"clean"}';
      if(code.includes("getLeavesOfType"))return JSON.stringify({state:'created',path:activeDrawing,ready:true,wrapper:true,ownerMatches:true,mainWindow:true});
      return '{"state":"loaded"}';
    }
    return "";
  };
  const featureScenario = ({ cli, drawingPath }) => {
    assert.equal(drawingPath, "__excalidraw_cli_smoke_1.excalidraw.md");
    assert.equal(cli("dev:errors"), "No errors captured.");
    return { id: "feature-test", status: "passed" };
  };
  let companionCleaned = 0;
  const options = { ...input, runCli, discoverPlugin:async()=>({discovery:'test-adapter'}), runBuild: () => ({pluginArtifactRoot:input.projectRoot,forkArtifacts:{verified:true}}), unique: () => "1", wait: () => {},
    deployCompanions: ({target}) => { assert.equal(target.config,input.configDir); return {evidence:{paired:true},cleanup:()=>{assert.equal(cleanupStarted,true);companionCleaned++;}}; } };
  const report = await runObsidianSmoke({ ...options, scenarios: [featureScenario,({drawingPath})=>{assert.equal(cleanupStarted,true,'Previous feature fixture must be retired first');assert.equal(drawingPath,'__excalidraw_cli_smoke_1_case1.excalidraw.md');return {id:'independent-feature',status:'passed'};}] });
  assert.equal(report.status, "passed", report.error);
  assert.equal(report.capabilities.version, "1.99.0-alpha.3");
  assert.equal(report.cleanup, "passed");
  assert.equal(report.target.drawingPath, "__excalidraw_cli_smoke_1_case1.excalidraw.md");
  assert.deepEqual(report.artifacts.sourceHashes, report.artifacts.installedHashes);
  assert.ok(commands.includes("plugin:enable"));
  assert.equal(commandReads, 2);
  assert.equal(report.scenarios.find((item) => item.id === "drawing-main-window").status, "passed");
  assert.equal(report.scenarios.find((item) => item.id === "feature-test").status, "passed");
  cleanupStarted = false;
  const failed = await runObsidianSmoke({ ...options, scenarios: [() => { throw new Error("feature regression"); }] });
  assert.equal(failed.status, "failed");
  assert.equal(failed.cleanup, "passed");
  assert.equal(cleanupStarted, true);
  assert.match(failed.error, /feature regression/);
  assert.equal(companionCleaned,2,'Companion state restores after both success and scenario failure');
  cleanupStarted = false;
  let unsafeContinuation=false;
  const pending = await runObsidianSmoke({...options,scenarios:[()=>{const error=Error('Unsettled native print');error.cleanupFailed=true;throw error;},()=>{unsafeContinuation=true;return{id:'unsafe',status:'passed'};}]});
  assert.equal(unsafeContinuation,false,'Unsettled native work must stop subsequent scenarios');
  assert.equal(pending.status,'failed');assert.equal(pending.cleanup,'failed');
  assert.equal(cleanupStarted,false,'A tooling deadline must preserve the native owner fixture');
  assert.equal(companionCleaned,2,'Unsettled native work must retain its loaded companion services');
  assert.match(pending.cleanupError,/preserved/);
  assert.equal(report.artifacts.companions.paired,true);
  let independentRan=false;
  const blocked = await runObsidianSmoke({...options,scenarios:[()=>({id:'required-feature',status:'blocked',reason:'Missing host capability'}),()=>{independentRan=true;return{id:'independent-after-failure',status:'passed'};}]});
  assert.equal(independentRan,true,'A settled failure must not omit independent scenarios');
  assert.equal(blocked.status,'failed');assert.match(blocked.error,/required-feature is blocked/);assert.equal(blocked.cleanup,'passed');
  const cleanupFailure=await runObsidianSmoke({...options,deployCompanions:()=>({evidence:{},cleanup:()=>{throw Error('owned companion cleanup failure');}})});
  assert.equal(cleanupFailure.status,'failed');assert.equal(cleanupFailure.cleanup,'failed');assert.match(cleanupFailure.cleanupError,/companion cleanup failure/);
});

test("an eval Error payload fails even when the CLI process reports success", async () => {
  const input = fixture();
  const report = await runObsidianSmoke({ ...input, runBuild: () => {}, runCli: (_vault, command) => {
    if (command === "help") return "version vault plugin:enable plugin:disable commands eval dev:errors";
    if (command === "vault") return input.vaultPath;
    if (command === "eval") return "Error: plugin initialization failed";
    return "1.13.0";
  } });
  assert.equal(report.status, "failed");
  assert.match(report.error, /Error: plugin initialization failed/);
  assert.equal(report.cleanup, "not-started");
});

test('a CLI session differing from the held application lock cannot build or deploy',async()=>{
  const input=fixture();let built=false;
  const report=await runObsidianSmoke({...input,expectedUserDataPath:input.projectRoot,runBuild:()=>{built=true;},runCli:(_vault,command,...args)=>{
    if(command==='help')return'version vault plugin:enable plugin:disable commands eval dev:errors';
    if(command==='vault')return input.vaultPath;
    if(command==='eval')return args[0].includes('app.vault.configDir')?'{"configDir":".obsidian"}':JSON.stringify(input.vaultPath);
    return'1.14.5';
  }});
  assert.equal(built,false);assert.equal(report.status,'failed');assert.match(report.error,/held host lock/);
});
