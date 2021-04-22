import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import postcss from 'rollup-plugin-postcss';
import copy from 'rollup-plugin-copy';
import { env } from "process";
import babel from '@rollup/plugin-babel';
import replace from "@rollup/plugin-replace";

const isProd = (process.env.NODE_ENV === "production");

console.log(process.env.NODE_ENV);
console.log("Is production", isProd);

export default {
  input: 'src/main.ts',
  output: {
    dir: isProd ? './dist' : '.',
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
    postcss({
      plugins: []
    }),
    copy({
      targets: [
        { src: ['manifest.json', 'styles.css'], dest: './dist' }
      ], flatten: true
    }),
    //process.env.NODE_ENV === 'production' && minify(),
  ]
};