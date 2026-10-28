/** Type-check the real plugin bridge against the installed fork declarations.
 * PR #472 changed dialog state without changing the host Mermaid service. A
 * runtime-only artifact copy must not conceal drift in the published types.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const root = resolve(import.meta.dirname, "../..");

const typesSource = process.env.EXCALIDRAW_TEST_FORK_TYPES_ROOT ? "generated local" : "installed";
test(`plugin host and public Mermaid declarations match the ${typesSource} fork`, () => {
  const configPath = resolve(root, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  assert.deepEqual(parsed.errors, []);
  const options = { ...parsed.options, noEmit: true, skipLibCheck: true };
  // Local artifact handoffs must check the matching generated declarations,
  // rather than accidentally validating only the older installed package.
  if (process.env.EXCALIDRAW_TEST_FORK_TYPES_ROOT) {
    const fork = resolve(process.env.EXCALIDRAW_TEST_FORK_TYPES_ROOT);
    const pkg = resolve(fork, "packages/excalidraw");
    const types = resolve(pkg, "types");
    assert.ok(existsSync(resolve(types, "excalidraw/obsidianExcalidrawHost.d.ts")), "Build the fork declarations first");
    options.paths = { ...options.paths,
      "@zsviczian/excalidraw": [resolve(types, "excalidraw/index.d.ts")],
      "@zsviczian/excalidraw/*": [resolve(pkg, "*")],
      "@excalidraw/excalidraw/*": [resolve(types, "excalidraw/*")],
      "@excalidraw/excalidraw/element/*": [resolve(types, "element/src/*")],
      "@excalidraw/mermaid-to-excalidraw": [resolve(fork, "node_modules/@excalidraw/mermaid-to-excalidraw/dist/index.d.ts")],
      "@excalidraw/mermaid-to-excalidraw/*": [resolve(fork, "node_modules/@excalidraw/mermaid-to-excalidraw/*")],
    };
    for (const name of ["common", "element", "math", "utils"]) {
      options.paths[`@excalidraw/${name}`] = [resolve(types, `${name}/src/index.d.ts`)];
      options.paths[`@excalidraw/${name}/*`] = [resolve(types, `${name}/src/*`)];
    }
  }
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
    const coordinatedProtocol: typeof Host.OBSIDIAN_EXCALIDRAW_HOST_PROTOCOL_VERSION = 3;
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
  host.getSourceFile = (file, ...args) => resolve(file) === fixturePath
    ? ts.createSourceFile(file, source, options.target, true)
    : originalGetSourceFile(file, ...args);
  const program = ts.createProgram([
    fixturePath,
    resolve(root, "src/types/types.d.ts"),
  ], options, host);
  const files = [fixturePath, resolve(root, "src/core/managers/obsidianExcalidrawHostAdapter.ts"), resolve(root, "src/core/main.ts")];
  const diagnostics = [
    ...program.getOptionsDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...files.flatMap(file => {
      const unit = program.getSourceFile(file);
      assert.ok(unit, `Compiler did not load ${file}`);
      return [...program.getSyntacticDiagnostics(unit), ...program.getSemanticDiagnostics(unit)];
    }),
  ];
  assert.equal(diagnostics.length, 0, ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: file => file,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n",
  }));
});
