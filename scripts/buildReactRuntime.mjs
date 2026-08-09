import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import { rollup } from "rollup";

/**
 * Bundles the official React package entrypoints into one window-evaluable
 * artifact for the Obsidian main window and popouts.
 *
 * @param {{ isProduction: boolean }} options Build-mode selection.
 * @returns {Promise<string>} Generated browser runtime source.
 */
export const buildReactRuntime = async ({ isProduction }) => {
  const mode = isProduction ? "production" : "development";
  const bundle = await rollup({
    input: "scripts/reactRuntimeEntry.mjs",
    treeshake: true,
    plugins: [
      replace({
        preventAssignment: true,
        "process.env.NODE_ENV": JSON.stringify(mode),
      }),
      nodeResolve({ browser: true, preferBuiltins: false }),
      commonjs(),
    ],
  });

  try {
    const { output } = await bundle.generate({
      format: "iife",
      name: "ObsidianExcalidrawReactRuntime",
      inlineDynamicImports: true,
      compact: isProduction,
      generatedCode: "es2015",
    });
    const chunk = output.find((item) => item.type === "chunk");
    if (!chunk) {
      throw new Error("React runtime build did not emit a JavaScript chunk");
    }
    return `${chunk.code}
var { React, ReactDOM, ReactJSXRuntime, ReactJSXDevRuntime } = ObsidianExcalidrawReactRuntime;`;
  } finally {
    await bundle.close();
  }
};
