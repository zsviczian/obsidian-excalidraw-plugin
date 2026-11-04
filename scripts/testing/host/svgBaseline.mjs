/** Build the pinned old converter as a test-only browser oracle, without network access. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { rollup } from "rollup";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import ts from "typescript";
import { spawnNativeSync } from "./processTools.mjs";

export const SVG_BASELINE_COMMIT = "5e4c83f6370f93d3f794ef7afb9545a6b6208c11";
/** Rebuilds the exact pre-change module graph into the runner's owned report directory. */
export async function buildSvgBaseline(projectRoot, reportDir) {
  const dir = join(reportDir, "baseline-source");
  mkdirSync(join(dir, "elements"), { recursive: true });
  for (const file of [
    "parser.ts",
    "walker.ts",
    "attributes.ts",
    "transform.ts",
    "utils.ts",
    "elements/Group.ts",
    "elements/ExcalidrawElement.ts",
    "elements/ExcalidrawScene.ts",
  ]) {
    const result = spawnNativeSync(
      "git",
      ["show", `${SVG_BASELINE_COMMIT}:src/shared/svgToExcalidraw/${file}`],
      { cwd: projectRoot, encoding: "utf8", timeout: 10000 },
    );
    if (result.status !== 0 || result.error)
      throw Error(`Cannot read pinned SVG baseline: ${file}`);
    writeFileSync(join(dir, file), result.stdout);
  }
  const bundle = await rollup({
    input: join(dir, "parser.ts"),
    plugins: [
      {
        name: "pinned-svg-baseline",
        resolveId(id) {
          if (id.endsWith("constants/constants")) return "\0constants";
          if (id.endsWith("utils/debugHelper")) return "\0log";
          if (id.endsWith("constants/safeUrls")) return "\0urls";
        },
        load(id) {
          if (id === "\0constants") return "export const ROUNDNESS={LEGACY:1}";
          if (id === "\0log") return "export const log=()=>{}";
          if (id === "\0urls")
            return 'export const URLs={GITHUB_COM_ZSVICZIAN_OBSIDIAN_EXCALIDRAW_PLUGIN_RELEASES_TAG:"https://github.com/zsviczian/obsidian-excalidraw-plugin/releases/tag"}';
        },
        transform(code, id) {
          if (id.endsWith(".ts"))
            return ts.transpileModule(code, {
              compilerOptions: {
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.ES2022,
              },
            }).outputText;
        },
      },
      nodeResolve({
        browser: true,
        extensions: [".ts", ".js"],
        modulePaths: [join(projectRoot, "node_modules")],
      }),
      commonjs(),
    ],
  });
  try {
    const { output } = await bundle.generate({
      format: "iife",
      name: "SvgBaseline",
      intro: 'const mainDocument=document;const PLUGIN_VERSION="baseline";',
    });
    const code = output[0].code;
    writeFileSync(join(reportDir, "baseline.js"), code);
    return code;
  } finally {
    await bundle.close();
  }
}
