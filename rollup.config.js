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



const mathjaxtosvg_pkg = isLib ? "" : fs.readFileSync("./MathjaxToSVG/dist/index.js", "utf8");

// Add non-English locales here to embed them as compressed payloads in main.js.
// When adding a locale file:
// 1) add its code to this list, 2) build once, 3) if build fails because the locale
// contains a new dynamic expression, extend tokenizeLocaleContent below and mirror
// the new token in src/lang/helpers.ts token resolution.
const LANGUAGES = ['ru', 'zh-cn', 'zh-tw', 'es']; // english is loaded by default

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

// Build-time placeholders that are resolved at runtime in src/lang/helpers.ts.
// Keep names stable and keep this map in sync with TOKENS in helpers.ts.
const DEVICE_TOKEN_VALUES = {
  IF_DESKTOP_START: "__EXD_IF_DESKTOP__",
  IF_DESKTOP_END: "__EXD_END_IF_DESKTOP__",
  IF_APPLE_START: "__EXD_IF_APPLE__",
  IF_APPLE_ELSE: "__EXD_ELSE_APPLE__",
  IF_APPLE_END: "__EXD_END_IF_APPLE__",
  DEVTOOLS_SHORTCUT: "__EXD_DEVTOOLS_SHORTCUT__",
};

function replaceDesktopConditionalBlocks(input, deviceTokens) {
  // Preserve desktop-only message fragments for runtime decision.
  const start = "${DEVICE.isDesktop ? `";
  const end = "` : \"\"}";
  let output = "";
  let cursor = 0;

  while (true) {
    const startIndex = input.indexOf(start, cursor);
    if (startIndex === -1) {
      output += input.slice(cursor);
      break;
    }

    const contentStart = startIndex + start.length;
    const endIndex = input.indexOf(end, contentStart);
    if (endIndex === -1) {
      output += input.slice(cursor);
      break;
    }

    output += input.slice(cursor, startIndex);
    output += `${deviceTokens.IF_DESKTOP_START}${input.slice(contentStart, endIndex)}${deviceTokens.IF_DESKTOP_END}`;
    cursor = endIndex + end.length;
  }

  return output;
}

function replaceAppleTernaryBlocks(input, deviceTokens) {
  // Preserve Apple vs non-Apple branch text for runtime decision.
  const appleTernaryRegex = /\(\s*DEVICE\.isIOS\s*\|\|\s*DEVICE\.isMacOS\s*\?\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*\)/g;

  return input.replace(appleTernaryRegex, (_, trueValue, falseValue) =>
    `"${deviceTokens.IF_APPLE_START}${trueValue}${deviceTokens.IF_APPLE_ELSE}${falseValue}${deviceTokens.IF_APPLE_END}"`
  );
}

function tokenizeLocaleContent(content, deviceTokens = DEVICE_TOKEN_VALUES) {
  let tokenized = content;

  tokenized = replaceDesktopConditionalBlocks(tokenized, deviceTokens);
  tokenized = replaceAppleTernaryBlocks(tokenized, deviceTokens);

  // Add new replacements here when locale files introduce new dynamic snippets.
  // Any new token emitted here must be handled in src/lang/helpers.ts.
  const replacements = [
    [/\$\{\s*labelALT\(\)\s*\}/g, "__EXD_LABEL_ALT__"],
    [/\$\{\s*labelCTRL\(\)\s*\}/g, "__EXD_LABEL_CTRL__"],
    [/\$\{\s*labelMETA\(\)\s*\}/g, "__EXD_LABEL_META__"],
    [/\$\{\s*labelSHIFT\(\)\s*\}/g, "__EXD_LABEL_SHIFT__"],
    [/\blabelALT\(\)/g, '"__EXD_LABEL_ALT__"'],
    [/\blabelCTRL\(\)/g, '"__EXD_LABEL_CTRL__"'],
    [/\blabelMETA\(\)/g, '"__EXD_LABEL_META__"'],
    [/\blabelSHIFT\(\)/g, '"__EXD_LABEL_SHIFT__"'],
    [/\$\{\s*FRONTMATTER_KEYS\["link-brackets"\]\.name\s*\}/g, "__EXD_FRONTMATTER_LINK_BRACKETS__"],
    [/\$\{\s*FRONTMATTER_KEYS\["link-prefix"\]\.name\s*\}/g, "__EXD_FRONTMATTER_LINK_PREFIX__"],
    [/\$\{\s*FRONTMATTER_KEYS\["url-prefix"\]\.name\s*\}/g, "__EXD_FRONTMATTER_URL_PREFIX__"],
    [/\$\{\s*CJK_FONTS\s*\}/g, "__EXD_CJK_FONTS__"],
    [/\$\{\s*PLUGIN_VERSION\s*\}/g, "__EXD_PLUGIN_VERSION__"],
    ["${DEVICE.isIOS || DEVICE.isMacOS ? \"CMD+OPT+i\" : \"CTRL+SHIFT+i\"}", deviceTokens.DEVTOOLS_SHORTCUT],
    ["${DEVICE.isMacOS ? \"CMD+OPT+i\" : \"CTRL+SHIFT+i\"}", deviceTokens.DEVTOOLS_SHORTCUT],
  ];

  for (const [pattern, replacement] of replacements) {
    if (typeof pattern === "string") {
      tokenized = tokenized.split(pattern).join(replacement);
    } else {
      tokenized = tokenized.replace(pattern, replacement);
    }
  }

  return tokenized;
}

function serializeLocaleToJson(content) {
  const assignmentCode = minifyCode(`x = ${content};`);
  const locale = new Function(`
    const TAG_AUTOEXPORT = "Autoexport";
    const TAG_MDREADINGMODE = "MDReadingMode";
    const TAG_PDFEXPORT = "PDFExport";
    let x = {};
    ${assignmentCode};
    return x;
  `)();
  return JSON.stringify(locale);
}

function compressLanguageFile(lang) {
  const inputDir = "./src/lang/locale";
  const filePath = `${inputDir}/${lang}.ts`;
  let content = fs.readFileSync(filePath, "utf-8");
  content = trimLastSemicolon(content.split("export default")[1].trim());
  const tokenizedContent = tokenizeLocaleContent(content);
  const localeJson = serializeLocaleToJson(tokenizedContent);
  return LZString.compressToBase64(localeJson);
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

const manifestStr = isLib ? "" : fs.readFileSync("manifest.json", "utf-8");
const manifest = isLib ? {} : JSON.parse(manifestStr);
if (!isLib) {
  console.log(manifest.version);
}

const packageString = isLib
  ? ""
  : ';const INITIAL_TIMESTAMP=Date.now();' + lzstring_pkg +
  '\nlet REACT_PACKAGES = `' +
  jsesc(react_pkg + reactdom_pkg + jsxRuntimeShim, { quotes: 'backtick' }) +
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
        [
          /(var[^;]*?),\s*React\s*=\s*require\(["']react["']\)([^;]*;)/,
          (_, g1, g2) => `${g1}${g2}${packageString}`
        ],
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
