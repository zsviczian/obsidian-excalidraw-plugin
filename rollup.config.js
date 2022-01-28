import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { env } from "process";
import babel from '@rollup/plugin-babel';
import replace from "@rollup/plugin-replace";
import visualizer from "rollup-plugin-visualizer";
import esbuild from 'rollup-plugin-esbuild';

const isProd = (process.env.NODE_ENV === "production");
console.log("Is production", isProd);

export default {
  input: 'src/main.ts',
  output: {
    dir: '.',
    sourcemap: 'inline',
    format: 'cjs',
    exports: 'default'
  },
  external: ['obsidian'],
  plugins: [
    typescript({inlineSources: !isProd}),
    nodeResolve({ browser: true, preferBuiltins: true }),
    replace({
      preventAssignment: true,
      "process.env.NODE_ENV": JSON.stringify(env.NODE_ENV),
    }),
    babel({
      exclude: "node_modules/**"
    }),
    commonjs(),
    visualizer(),
  ],
};