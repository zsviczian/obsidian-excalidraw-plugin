import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import postcss from 'rollup-plugin-postcss';
import copy from 'rollup-plugin-copy';
import minify from 'rollup-plugin-minify';


const isProd = (process.env.NODE_ENV === "production");

export default {
  input: 'src/main.ts',
  output: {
    dir: isProd ? './dist' : '.',
    sourcemap: 'inline',
    format: 'cjs',
    exports: 'default'
  },
  external: ['obsidian', 'crypto'],
  plugins: [
    typescript({inlineSources: !isProd}),
    nodeResolve({ browser: true, preferBuiltins: true }),
    commonjs(),
    postcss({
      plugins: []
    }),
    copy({
      targets: [
        { src: ['manifest.json', 'styles.css'], dest: './dist' }
      ], flatten: true
    }),
    minify(),
  ]
};