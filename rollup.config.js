import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from "@rollup/plugin-replace";
import { terser } from "rollup-plugin-terser";
import copy from "rollup-plugin-copy";
import typescript2 from "rollup-plugin-typescript2";
import fs from 'fs';
import path from 'path';
import LZString from 'lz-string';
import postprocess from '@zsviczian/rollup-plugin-postprocess';
import cssnano from 'cssnano';
import jsesc from 'jsesc';
import { minify } from 'uglify-js';
import json from '@rollup/plugin-json';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const DIST_FOLDER = 'dist';
const absolutePath = path.resolve(DIST_FOLDER);
fs.mkdirSync(absolutePath, { recursive: true });
const isProd = (process.env.NODE_ENV === "production");
const isLib = (process.env.NODE_ENV === "lib");
console.log(`Running: ${process.env.NODE_ENV}; isProd: ${isProd}; isLib: ${isLib}`);

const mathjaxtosvg_pkg = isLib ? "" : fs.readFileSync("./MathjaxToSVG/dist/index.js", "utf8");

const LANGUAGES = ['ru', 'zh-cn']; //english is not compressed as it is always loaded by default

function trimLastSemicolon(input) {
  if (input.endsWith(";")) {
    return input.slice(0, -1);
  }
  return input;
}

function minifyCode(code) {
  const minified = minify(code, {
    compress: {
      //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/2170
      reduce_vars: false,
    },
    mangle: true,
    output: {
      comments: false,
      beautify: false,
    }
  });

  if (minified.error) {
    throw new Error(minified.error);
  }
  return minified.code;
}

function compressLanguageFile(lang) {
  const inputDir = "./src/lang/locale";
  const filePath = `${inputDir}/${lang}.ts`;
  let content = fs.readFileSync(filePath, "utf-8");
  content = trimLastSemicolon(content.split("export default")[1].trim());
  return LZString.compressToBase64(minifyCode(`x = ${content};`));
}

const excalidraw_pkg = isLib ? "" : minifyCode(isProd
  ? fs.readFileSync("./node_modules/@zsviczian/excalidraw/dist/excalidraw.production.min.js", "utf8")
  : fs.readFileSync("./node_modules/@zsviczian/excalidraw/dist/excalidraw.development.js", "utf8"));
const react_pkg = isLib ? "" : minifyCode(isProd
  ? fs.readFileSync("./node_modules/react/umd/react.production.min.js", "utf8")
  : fs.readFileSync("./node_modules/react/umd/react.development.js", "utf8"));
const reactdom_pkg = isLib ? "" : minifyCode(isProd
  ? fs.readFileSync("./node_modules/react-dom/umd/react-dom.production.min.js", "utf8")
  : fs.readFileSync("./node_modules/react-dom/umd/react-dom.development.js", "utf8"));

const lzstring_pkg = isLib ? "" : fs.readFileSync("./node_modules/lz-string/libs/lz-string.min.js", "utf8");
if (!isLib) {
  const excalidraw_styles = isProd
    ? fs.readFileSync("./node_modules/@zsviczian/excalidraw/dist/styles.production.css", "utf8")
    : fs.readFileSync("./node_modules/@zsviczian/excalidraw/dist/styles.development.css", "utf8");
  const plugin_styles = fs.readFileSync("./styles.css", "utf8");
  const styles = plugin_styles + excalidraw_styles;
  cssnano()
    .process(styles) // Process the CSS
    .then(result => {
      fs.writeFileSync(`./${DIST_FOLDER}/styles.css`, result.css);
    })
    .catch(error => {
      console.error('Error while processing CSS:', error);
    });
}

const manifestStr = isLib ? "" : fs.readFileSync("manifest.json", "utf-8");
const manifest = isLib ? {} : JSON.parse(manifestStr);
if (!isLib) {
  console.log(manifest.version);
}

const packageString = isLib
  ? ""
  : ';const INITIAL_TIMESTAMP=Date.now();' + lzstring_pkg +
  '\nlet REACT_PACKAGES = `' +
  jsesc(react_pkg + reactdom_pkg, { quotes: 'backtick' }) +
  '`;\n' +
  'const unpackExcalidraw = () => LZString.decompressFromBase64("' + LZString.compressToBase64(excalidraw_pkg) + '");\n' +
  'let {react, reactDOM } = new Function(`${REACT_PACKAGES}; return {react: React, reactDOM: ReactDOM};`)();\n' +
  'let excalidrawLib = {};\n' +
  'const loadMathjaxToSVG = () => new Function(`${LZString.decompressFromBase64("' + LZString.compressToBase64(mathjaxtosvg_pkg) + '")}; return MathjaxToSVG;`)();\n' +
  `const PLUGIN_LANGUAGES = {${LANGUAGES.map(lang => `"${lang}": "${compressLanguageFile(lang)}"`).join(",")}};\n` +
  'const PLUGIN_VERSION="' + manifest.version + '";';

const BASE_CONFIG = {
  input: 'src/core/main.ts',
  external: [
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    'obsidian',
    '@zsviczian/excalidraw',
    'react',
    'react-dom'
  ],
};

const getRollupPlugins = (tsconfig, ...plugins) => [
  typescript2(tsconfig),
  json(),
  replace({
    preventAssignment: true,
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
  }),
  commonjs(),
  nodeResolve({ browser: true, preferBuiltins: false }),
].concat(plugins);

const BUILD_CONFIG = {
  ...BASE_CONFIG,
  output: {
    dir: DIST_FOLDER,
    entryFileNames: 'main.js',
    format: 'cjs',
    exports: 'default',
    inlineDynamicImports: true, // Add this line only
  },
  plugins: getRollupPlugins(
    {
      tsconfig: isProd ? "tsconfig.json" : "tsconfig.dev.json",
      sourcemap: !isProd,
      clean: true,
      //verbosity: isProd ? 1 : 2,
    },
    ...(isProd ? [
      terser({
        toplevel: false,
        compress: { passes: 2 },
        format: {
          comments: false, // Remove all comments
        },
      }),
      postprocess([
        [/React=require\("react"\),state=require\("@codemirror\/state"\),view=require\("@codemirror\/view"\)/,
        `state=require("@codemirror/state"),view=require("@codemirror/view")` + packageString],
      ]),
    ] : [
      postprocess([ [/var React = require\('react'\);/, packageString] ]),
    ]),
    copy({
      targets: [ { src: 'manifest.json', dest: DIST_FOLDER } ],
      verbose: true,
    }),
  ),
};

const LIB_CONFIG = {
  ...BASE_CONFIG,
  input: "src/core/index.ts",
  output: {
    dir: "lib",
    sourcemap: false,
    format: "cjs",
    name: "Excalidraw (Library)",
  },
  plugins: getRollupPlugins(
    { tsconfig: "tsconfig-lib.json" },
    copy({ targets: [{ src: "src/*.d.ts", dest: "lib/typings" }] })
  ),
};

let config = [];
if (process.env.NODE_ENV === "lib") {
  config.push(LIB_CONFIG);
} else {
  config.push(BUILD_CONFIG);
}

export default config;
