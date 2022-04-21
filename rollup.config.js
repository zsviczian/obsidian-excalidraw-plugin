import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { env } from "process";
import babel from '@rollup/plugin-babel';
import replace from "@rollup/plugin-replace";
import { terser } from "rollup-plugin-terser";
import copy from "rollup-plugin-copy";
import ttypescript from "ttypescript";
import typescript2 from "rollup-plugin-typescript2";
import webWorker from "rollup-plugin-web-worker-loader";

const isProd = (process.env.NODE_ENV === "production");
console.log("Is production", isProd);

const BASE_CONFIG = {
  input: 'src/main.ts',
  external: ['obsidian'],
}

const getRollupPlugins = (tsconfig, ...plugins) =>
    [
        typescript2(tsconfig),
        nodeResolve({ browser: true }),
        commonjs(),
        webWorker({ inline: true, forceInline: true, targetPlatform: "browser" }),
    ].concat(plugins);

const BUILD_CONFIG = {
  ...BASE_CONFIG,
  output: {
    dir: '.',
    sourcemap: 'inline',
    format: 'cjs',
    exports: 'default',
  },
  plugins: [
    replace({
      preventAssignment: true,
      "process.env.NODE_ENV": JSON.stringify(env.NODE_ENV),
    }),
    babel({
      exclude: "node_modules/**"
    }),
    commonjs(),
    nodeResolve({ browser: true, preferBuiltins: true }),
    typescript({inlineSources: !isProd}),
    ...isProd ? [
      terser({toplevel: true, compress: {passes: 2}})
    ] : []
  ],
}

const LIB_CONFIG = {
  ...BASE_CONFIG,
  input: "src/index.ts",
  output: {
    dir: "lib",
    sourcemap: true,
    format: "cjs",
    name: "Excalidraw (Library)",
  },
  plugins: getRollupPlugins(
      { tsconfig: "tsconfig-lib.json", typescript: ttypescript },
      copy({ targets: [{ src: "src/*.d.ts", dest: "lib/typings" }] })
  ),  
}

let config = [];
if(process.env.NODE_ENV === "lib") {
  config.push(LIB_CONFIG);
} else {
  config.push(BUILD_CONFIG);
}

export default config;