import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { env } from "process";
import babel from '@rollup/plugin-babel';
import replace from "@rollup/plugin-replace";
import { terser } from "rollup-plugin-terser";
import copy from "rollup-plugin-copy";
import typescript2 from "rollup-plugin-typescript2";
import webWorker from "rollup-plugin-web-worker-loader";
import fs from'fs';
import LZString from 'lz-string';
import postprocess from 'rollup-plugin-postprocess';
import cssnano from 'cssnano';

const DIST_FOLDER = 'dist'; 
const isProd = (process.env.NODE_ENV === "production")
const isLib = (process.env.NODE_ENV === "lib");
console.log(`Running: ${process.env.NODE_ENV}`);

const excalidraw_pkg = isLib ? "" : isProd
  ? fs.readFileSync("./node_modules/@zsviczian/excalidraw/dist/excalidraw.production.min.js", "utf8")
  : fs.readFileSync("./node_modules/@zsviczian/excalidraw/dist/excalidraw.development.js", "utf8");
const react_pkg = isLib ? "" : isProd
  ? fs.readFileSync("./node_modules/react/umd/react.production.min.js", "utf8")
  : fs.readFileSync("./node_modules/react/umd/react.development.js", "utf8");
const reactdom_pkg = isLib ? "" : isProd
  ? fs.readFileSync("./node_modules/react-dom/umd/react-dom.production.min.js", "utf8")
  : fs.readFileSync("./node_modules/react-dom/umd/react-dom.development.js", "utf8");

const lzstring_pkg = isLib ? "" : fs.readFileSync("./node_modules/lz-string/libs/lz-string.min.js", "utf8");
if(!isLib) {
  const excalidraw_styles = isProd
    ? fs.readFileSync("./node_modules/@zsviczian/excalidraw/dist/styles.production.css", "utf8")
    : fs.readFileSync("./node_modules/@zsviczian/excalidraw/dist/styles.development.css", "utf8");
  const plugin_styles = fs.readFileSync("./styles.css", "utf8")
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
!isLib && console.log(manifest.version);

const packageString = isLib 
  ? "" 
  : ';' + lzstring_pkg +
    '\nconst EXCALIDRAW_PACKAGES = "' + LZString.compressToBase64(react_pkg + reactdom_pkg + excalidraw_pkg) + '";\n' +
    'const {react, reactDOM, excalidrawLib} = window.eval.call(window, `(function() {' +
    '${LZString.decompressFromBase64(EXCALIDRAW_PACKAGES)};' +
    'return {react:React, reactDOM:ReactDOM, excalidrawLib: ExcalidrawLib};})();`);\n' +
    'const PLUGIN_VERSION="'+manifest.version+'";';

const BASE_CONFIG = {
  input: 'src/main.ts',
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
    dir: DIST_FOLDER,
    entryFileNames: 'main.js',
    //sourcemap: isProd?false:'inline',
    format: 'cjs',
    exports: 'default',
  },
  plugins: [
    typescript2({
      tsconfig: isProd ? "tsconfig.json" : "tsconfig.dev.json",
      //inlineSources: !isProd
    }),
    replace({
      preventAssignment: true,
      "process.env.NODE_ENV": JSON.stringify(env.NODE_ENV),
    }),
    babel({
      presets: [['@babel/preset-env', {
        targets: {
          esmodules: true,
        },
      }]],
      exclude: "node_modules/**"
    }),
    commonjs(),
    nodeResolve({ browser: true, preferBuiltins: false }),
    ...isProd 
    ? [
      terser({
        toplevel: false,
        compress: {passes: 2}
      }),
      //!postprocess - the version available on npmjs does not work, need this update: 
      //  npm install brettz9/rollup-plugin-postprocess#update --save-dev
      //  https://github.com/developit/rollup-plugin-postprocess/issues/10
      postprocess([
        //[/,React=require\("react"\);/, packageString],
        [/React=require\("react"\),state=require\("@codemirror\/state"\),view=require\("@codemirror\/view"\)/,
        `state=require("@codemirror/state"),view=require("@codemirror/view")` + packageString]
      ])
    ] 
    : [
      postprocess([
        [/var React = require\('react'\);/, packageString],
      ])
    ],
    copy({
      targets: [
        { src: 'manifest.json', dest: DIST_FOLDER },
      ],
      verbose: true, // Optional: To display copied files in the console
    }),
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
      { tsconfig: "tsconfig-lib.json"},
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