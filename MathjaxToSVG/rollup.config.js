import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

const isProd = (process.env.NODE_ENV === 'production');

export default {
  input: './index.ts',
  output: {
    dir: 'dist',
    format: 'iife',
    name: 'MathjaxToSVG', // Global variable name
    exports: 'named',
    sourcemap: !isProd,
  },
  plugins: [
    typescript({
      tsconfig: 'tsconfig.json',
    }),
    commonjs(),
    nodeResolve({
      browser: true,
      preferBuiltins: false
    }),
    isProd && terser({
      format: {
        comments: false,
      },
      compress: {
        passes: 2,
      }
    })
  ].filter(Boolean)
};
