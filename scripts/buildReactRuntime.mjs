import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import { rollup } from "rollup";

/**
 * Bundles the official React package entrypoints into one function-evaluable
 * artifact for the plugin's shared private runtime.
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
    // Electron exposes Node's setImmediate in the browser. React otherwise
    // selects its shared libuv loop, whose callbacks can fail while another
    // window's Node environment is freed (electron/electron#53041). Keep this
    // choice lexical to our private runtime so React uses its browser scheduler
    // without changing the host's globals or the official package entrypoints.
    return `var ObsidianExcalidrawReactRuntime = (() => {
const setImmediate = undefined;
${chunk.code}
return ObsidianExcalidrawReactRuntime;
})();
var { React, ReactDOM, ReactJSXRuntime, ReactJSXDevRuntime } = ObsidianExcalidrawReactRuntime;`;
  } finally {
    await bundle.close();
  }
};
