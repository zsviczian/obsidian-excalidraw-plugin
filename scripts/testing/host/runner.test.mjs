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
  let commandReads = 0;
  const runCli = (_vault, command, ...args) => {
    commands.push(command);
    if (command === "version") return "1.13.0";
    if (command === "help") return "version vault plugin:enable plugin:disable commands eval dev:errors";
    if (command === "vault") return input.vaultPath;
    if (command === "commands") {
      commandReads++;
      return commandReads > 1 ? "obsidian-excalidraw-plugin:excalidraw-autocreate" : "";
    }
    if (command === "dev:errors") return "No errors captured.";
    if (command === "eval") {
      const code = args[0];
      if (code.includes("app.vault.configDir")) return '{"configDir":".obsidian"}';
      if (code.includes("createAndOpenDrawing")) {
        assert.ok(code.includes("useExcalidrawExtension"));
        assert.ok(code.includes('"new-tab","/"'));
        return '=> {"state":"started"}';
      }
      if (code.includes("app.vault.delete")) {
        assert.ok(code.indexOf('await leaf.setViewState({type:"empty",state:{}})') < code.indexOf("await app.vault.delete(file)"));
        cleanupStarted = true;
        return '{"state":"cleaning"}';
      }
      if (code.includes("?.state||")) return cleanupStarted ? '{"state":"clean"}' : '{"state":"created"}';
      if (code.includes("delete globalThis.__excalidrawCliSmoke")) return '{"state":"clean"}';
      if (code.includes("getLeavesOfType")) return '{"state":"created","path":"__excalidraw_cli_smoke_1.excalidraw.md","ready":true,"wrapper":true,"ownerMatches":true,"mainWindow":true}';
      return '{"state":"loaded"}';
    }
    return "";
  };
  const featureScenario = ({ cli, drawingPath }) => {
    assert.equal(drawingPath, "__excalidraw_cli_smoke_1.excalidraw.md");
    assert.equal(cli("dev:errors"), "No errors captured.");
    return { id: "feature-test", status: "passed" };
  };
  const options = { ...input, runCli, runBuild: () => {}, unique: () => "1", wait: () => {} };
  const report = await runObsidianSmoke({ ...options, scenarios: [featureScenario] });
  assert.equal(report.status, "passed", report.error);
  assert.equal(report.cleanup, "passed");
  assert.equal(report.target.drawingPath, "__excalidraw_cli_smoke_1.excalidraw.md");
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
