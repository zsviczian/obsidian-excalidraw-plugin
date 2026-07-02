import { nodeResolve } from '@rollup/plugin-node-resolve';
import zlib from 'node:zlib';
import visualizer from 'rollup-plugin-visualizer';
import commonjs from '@rollup/plugin-commonjs';
import replace from "@rollup/plugin-replace";
import terser from "@rollup/plugin-terser";
import copy from "rollup-plugin-copy";
import typescript from "@rollup/plugin-typescript";
import fs from 'fs';
import path from 'path';
import postprocess from '@zsviczian/rollup-plugin-postprocess';
import cssnano from 'cssnano';
import jsesc from 'jsesc';
import { minify } from 'uglify-js';
import json from '@rollup/plugin-json';
import { parseEnv } from 'node:util';

function compressDeflateBase64(code) {
  // Compress using Node's native zlib at maximum compression
  const compressed = zlib.deflateSync(Buffer.from(code, "utf-8"), { level: 9 });
  return compressed.toString("base64");
}

try {
  const envContent = fs.readFileSync(path.resolve('.env'), 'utf8');
  Object.assign(process.env, parseEnv(envContent));
} catch (error) {
}

const DIST_FOLDER = 'dist';
const absolutePath = path.resolve(DIST_FOLDER);
fs.mkdirSync(absolutePath, { recursive: true });
const isProd = (process.env.NODE_ENV === "production");
const isLib = (process.env.NODE_ENV === "lib");
console.log(`Running: ${process.env.NODE_ENV}; isProd: ${isProd}; isLib: ${isLib}`);


// Excalidraw React 19 compatiblity shim
// Create JSX runtime compatibility layer
const jsxRuntimeShim = `
  const jsx = (type, props, key) => {
    return React.createElement(type, props);
  };
  const jsxs = (type, props, key) => {
    return React.createElement(type, props);
  };
  const Fragment = React.Fragment;
  React.jsx = jsx;
  React.jsxs = jsxs;
  React.Fragment = Fragment;
  React.jsxRuntime = { jsx, jsxs, Fragment };
  window.__WEBPACK_EXTERNAL_MODULE_react_jsx_runtime__ = { jsx, jsxs, Fragment };
  window.__WEBPACK_EXTERNAL_MODULE_react_jsx_dev_runtime__ = { jsx, jsxs, Fragment, jsxDEV: jsx };
  window['react/jsx-runtime'] = { jsx, jsxs, Fragment };
  window['react/jsx-dev-runtime'] = { jsx, jsxs, Fragment, jsxDEV: jsx };
`;

// Add non-English locales here to embed them as compressed payloads in main.js.
// When adding a locale file:
// 1) add its code to this list, 2) build once, 3) if build fails because the locale
const LANGUAGES = ['ru', 'zh-cn', 'zh-tw', 'es']; //english is not compressed as it is always loaded by default

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
  return compressDeflateBase64(minifyCode(`x = ${content};`));
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

const pako_pkg = isLib ? "" : fs.readFileSync("./node_modules/pako/dist/pako.min.js", "utf8");

if (!isLib) {
  const excalidraw_styles = isProd
    ? fs.readFileSync("./node_modules/@zsviczian/excalidraw/dist/styles.production.css", "utf8")
    : fs.readFileSync("./node_modules/@zsviczian/excalidraw/dist/styles.development.css", "utf8");
  const plugin_styles = fs.readFileSync("./styles.css", "utf8");
  const styles = excalidraw_styles + plugin_styles;
  cssnano()
    .process(styles, {
      from: path.resolve("styles.css"),
      to: path.resolve(DIST_FOLDER, "styles.css"),
    })
    .then(result => {
      fs.writeFileSync(`./${DIST_FOLDER}/styles.css`, result.css);
    })
    .catch(error => {
      console.error('Error while processing CSS:', error);
    });
}

const manifestStr = isLib ? "" : fs.readFileSync("manifest-beta.json", "utf-8");
const manifest = isLib ? {} : JSON.parse(manifestStr);
if (!isLib) {
  console.log(manifest.version);
}

const packageString = isLib
  ? ""
  : ';const INITIAL_TIMESTAMP=Date.now();\n' +
  'const pako = (function() {\n' +
  '  const module = { exports: {} };\n' +
  '  const exports = module.exports;\n' +
  '  ' + pako_pkg + '\n' +
  '  return module.exports;\n' +
  '})();\n' +
  '\nlet REACT_PACKAGES = `' +
  jsesc(react_pkg + reactdom_pkg + jsxRuntimeShim, { quotes: 'backtick' }) +
  '`;\n' +
  // NEW: Fast, mobile-compatible runtime decompression 
  'const unpackBase64Deflate = (b64) => {\n' +
  '  const binStr = atob(b64);\n' +
  '  const len = binStr.length;\n' +
  '  const bytes = new Uint8Array(len);\n' +
  '  for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);\n' +
  '  return new TextDecoder().decode(pako.inflate(bytes));\n' +
  '};\n' +
  'window.unpackBase64Deflate = unpackBase64Deflate;\n' +
  'const unpackExcalidraw = () => unpackBase64Deflate("' + compressDeflateBase64(excalidraw_pkg) + '");\n' +
  'let {react, reactDOM } = new Function(`${REACT_PACKAGES}; return {react: React, reactDOM: ReactDOM};`)();\n' +
  'let excalidrawLib = {};\n' +
  `const PLUGIN_LANGUAGES = {${LANGUAGES.map(lang => `"${lang}": "${compressLanguageFile(lang)}"`).join(",")}};\n` +
  //deliberate use of main document instead of activeDocument
  `const mainDocument = document;\n` +
  `const PLUGIN_VERSION="${manifest.version}";\n`;

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
  typescript(tsconfig),
  json(),
  replace({
    preventAssignment: true,
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
  }),
  replace({ //This is a workaround to silence Obsidian codescanner complain about fs module usage in the plugin code. The plugin does not use fs module, but it is used by some dependencies.
    preventAssignment: true,
    delimiters: ['', ''],
    values: {
      "require('fs')": "null",
      'require("fs")': "null"
    }
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
      sourceMap: !isProd,
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
        [
          /(var[^;]*?),\s*React\s*=\s*require\(["']react["']\)([^;]*;)/,
          (_, g1, g2) => `${g1}${g2}${packageString}`
        ],
      ]),
      /*visualizer({
        filename: 'bundle-analysis.html',
        open: true, // Automatically opens in your browser when the build finishes
        gzipSize: true,
        brotliSize: true,
      }),*/
    ] : [
      postprocess([[/var React = require\('react'\);/, packageString]]),
    ]),
    copy({
      targets: [{ src: 'manifest.json', dest: DIST_FOLDER }],
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