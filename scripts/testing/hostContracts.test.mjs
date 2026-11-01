/** Check the real bridge against installed or byte-matched local fork declarations. */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";
import { localExcalidrawTypePaths } from "../excalidrawTypeSource.mjs";

const root = resolve(import.meta.dirname, "../..");

const localPaths = localExcalidrawTypePaths(
  root,
  process.env.EXCALIDRAW_FORK_ROOT,
);
const typesSource = localPaths ? "byte-matched local" : "installed";
test(`plugin host and public Mermaid declarations match the ${typesSource} fork`, () => {
  const configPath = resolve(root, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  assert.deepEqual(parsed.errors, []);
  const options = { ...parsed.options, noEmit: true, skipLibCheck: true };
  options.paths = { ...options.paths, ...localPaths };
  const fixturePath = resolve(root, "scripts/testing/hostContracts.fixture.ts");
  const source = `
    import type ExcalidrawPlugin from "../../src/core/main";
    import { ExcalidrawLib } from "../../src/types/excalidrawLib";
    import { createObsidianExcalidrawHostAdapter } from "../../src/core/managers/obsidianExcalidrawHostAdapter";
    import type * as Host from "@zsviczian/excalidraw/types/excalidraw/obsidianExcalidrawHost";
    import type * as Utils from "@zsviczian/excalidraw/types/excalidraw/obsidianUtils";

    declare const plugin: ExcalidrawPlugin;
    declare const canonical: Host.ObsidianExcalidrawHostAdapter;
    declare const canonicalLoader: typeof Utils.loadMermaid;
    declare const canonicalConfigure: typeof Host.configureObsidianExcalidrawHost;
    const coordinatedProtocol: typeof Host.OBSIDIAN_EXCALIDRAW_HOST_PROTOCOL_VERSION = 4;
    const namedAction: Host.ObsidianExcalidrawHostAdapter["runAction"] =
      (action, editorId) => plugin.runAction(action, editorId);
    const adapter: Host.ObsidianExcalidrawHostAdapter =
      createObsidianExcalidrawHostAdapter(plugin, ExcalidrawLib.OBSIDIAN_EXCALIDRAW_HOST_PROTOCOL_VERSION);
    const bridge: ExcalidrawLib.ObsidianExcalidrawHostAdapter = canonical;
    const service: Host.ObsidianExcalidrawHostAdapter["getMermaid"] = () => plugin.getMermaid();
    const loader: typeof Utils.loadMermaid = ExcalidrawLib.loadMermaid;
    const bridgeLoader: typeof ExcalidrawLib.loadMermaid = canonicalLoader;
    const configure: typeof Host.configureObsidianExcalidrawHost = ExcalidrawLib.configureObsidianExcalidrawHost;
    const bridgeConfigure: typeof ExcalidrawLib.configureObsidianExcalidrawHost = canonicalConfigure;
  `;
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (file, ...args) =>
    resolve(file) === fixturePath
      ? ts.createSourceFile(file, source, options.target, true)
      : originalGetSourceFile(file, ...args);
  const program = ts.createProgram(
    [fixturePath, resolve(root, "src/types/types.d.ts")],
    options,
    host,
  );
  const files = [
    fixturePath,
    resolve(root, "src/core/managers/obsidianExcalidrawHostAdapter.ts"),
    resolve(root, "src/core/main.ts"),
  ];
  const diagnostics = [
    ...program.getOptionsDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...files.flatMap((file) => {
      const unit = program.getSourceFile(file);
      assert.ok(unit, `Compiler did not load ${file}`);
      return [
        ...program.getSyntacticDiagnostics(unit),
        ...program.getSemanticDiagnostics(unit),
      ];
    }),
  ];
  assert.equal(
    diagnostics.length,
    0,
    ts.formatDiagnostics(diagnostics, {
      getCanonicalFileName: (file) => file,
      getCurrentDirectory: () => root,
      getNewLine: () => "\n",
    }),
  );
});
