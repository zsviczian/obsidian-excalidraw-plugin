/** Checks the production artifact's runtime bootstrap and offline asset contract. Build first. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import { parseAst } from "rollup/parseAst";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const code = read("dist/main.js");
const ast = parseAst(code);

function visit(node, callback) {
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string") callback(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => visit(child, callback));
    else if (value && typeof value === "object") visit(value, callback);
  }
}

function declaration(name) {
  const matches = ast.body.filter((node) => node.type === "VariableDeclaration" &&
    node.declarations.some((item) => item.id.name === name));
  assert.equal(matches.length, 1, `Expected one injected ${name} declaration`);
  return matches[0];
}

// Execute only the shipped bootstrap in a browser-like realm. No Obsidian or
// network is available: synchronous inflation must supply the private runtime.
const context = createContext({ atob, TextDecoder, Uint8Array, console, document: {} });
runInContext("window = globalThis;", context);
runInContext(code.slice(declaration("INITIAL_TIMESTAMP").start,
  declaration("deliberateCreateElement").end), context);
const runtimeSource = runInContext("unpackExcalidraw()", context);

function fontAssets(source) {
  const assets = new Set();
  visit(parseAst(source), (node) => {
    if (node.type === "Literal" && typeof node.value === "string" &&
      /^data:(?:font\/|application\/(?:font|x-font))[^,]*;base64,[A-Za-z0-9+/]+=*$/.test(node.value)) {
      // Compare font bytes, excluding MIME prefixes used by dynamic font loaders.
      // Hashes also keep a failed assertion from printing megabytes of Base64.
      const bytes = Buffer.from(node.value.slice(node.value.indexOf(",") + 1), "base64");
      assets.add(createHash("sha256").update(bytes).digest("hex"));
    }
  });
  return [...assets].sort();
}

test("production bootstrap supplies matching private React and JSX runtimes", () => {
  const reactVersion = JSON.parse(read("node_modules/react/package.json")).version;
  const domVersion = JSON.parse(read("node_modules/react-dom/package.json")).version;
  assert.equal(runInContext("React.version", context), reactVersion);
  assert.equal(runInContext("ReactDOM.version", context), domVersion);
  for (const expression of ["React.createElement", "ReactDOM.createRoot", "ReactDOM.flushSync",
    "ReactJSXRuntime.jsx", "ReactJSXRuntime.jsxs", "ReactJSXDevRuntime.jsxDEV"]) {
    assert.equal(runInContext(`typeof ${expression}`, context), "function", expression);
  }
  assert.equal(runInContext("window.React", context), undefined);
  assert.equal(runInContext("window.ReactDOM", context), undefined);
  const dependencies = new Set();
  visit(ast, (node) => {
    if (node.type === "CallExpression" && node.callee.type === "Identifier" &&
      node.callee.name === "require") dependencies.add(node.arguments[0]?.value);
  });
  for (const dependency of ["react", "react-dom", "react-dom/client", "@zsviczian/excalidraw"]) {
    assert.ok(!dependencies.has(dependency), `Runtime dependency must be bundled: ${dependency}`);
  }
});

test("compressed Excalidraw retains every published offline font asset", () => {
  const original = read("node_modules/@zsviczian/excalidraw/dist/obsidian/excalidraw.production.min.js");
  const expected = fontAssets(original);
  assert.ok(expected.length > 0, "Published artifact must contain offline fonts");
  assert.deepEqual(fontAssets(runtimeSource), expected);
  assert.ok(!runtimeSource.includes("//# sourceMappingURL="));
  assert.ok(!code.includes("//# sourceMappingURL="));
});

test("all maintained language payloads inflate and parse synchronously", () => {
  const languages = runInContext("Object.keys(PLUGIN_LANGUAGES).sort()", context);
  assert.deepEqual(Array.from(languages), ["es", "ru", "zh-cn", "zh-tw"]);
  for (const language of languages) {
    const source = runInContext(`unpackBase64Deflate(PLUGIN_LANGUAGES[${JSON.stringify(language)}])`, context);
    assert.ok(source.startsWith("x="), `Invalid locale payload: ${language}`);
    assert.doesNotThrow(() => parseAst(source), `Invalid locale syntax: ${language}`);
  }
});

test("production main.js remains below the release size target", () => {
  const bytes = Buffer.byteLength(code);
  assert.ok(bytes < 5 * 1024 * 1024, `${fileURLToPath(new URL("dist/main.js", root))}: ${bytes} bytes`);
});
