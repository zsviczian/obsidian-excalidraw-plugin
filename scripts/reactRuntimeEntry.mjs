/**
 * Browser entry for the private React runtime used by Excalidraw.
 *
 * The plugin evaluates the generated artifact in a private function scope once
 * per Obsidian window. Keep these exports aligned with the lexical externals
 * configured by the Excalidraw `build:obsidian` package target.
 */
import React from "react";
import ReactDOMLegacy from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import * as jsxDevRuntime from "react/jsx-dev-runtime";
import * as jsxRuntime from "react/jsx-runtime";

const ReactDOM = Object.assign({}, ReactDOMLegacy, ReactDOMClient);
const ReactJSXRuntime = jsxRuntime;
const ReactJSXDevRuntime = Object.assign({}, jsxDevRuntime, {
  // Keep a callable production fallback for bundles compiled against the
  // development JSX runtime entrypoint.
  jsxDEV: jsxDevRuntime.jsxDEV || jsxRuntime.jsx,
});

export { React, ReactDOM, ReactJSXRuntime, ReactJSXDevRuntime };
